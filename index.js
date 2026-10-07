const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const { MongoClient, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const app = express();

const port = 3100;
require("dotenv").config();
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());

const uri = process.env.MONGODB_URI;

// console.log("Mongo URI exists:", !!process.env.MONGODB_URI);
const JWKS = createRemoteJWKSet(new URL("http://localhost:3000/api/auth/jwks"));
const client = new MongoClient(uri);
const database = client.db("RecipeDB");
const recipes = database.collection("Recipes");
const savedRecipes = database.collection("SavedRecipes");
const reportRecipes = database.collection("reportRecipes");
const users = database.collection("user");
const transactions = database.collection("transactions");

async function connectToMongoDB() {
  try {
    const authenticate = async (req, res, next) => {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({
          message: "Unauthorized Access",
        });
      }

      const token = authHeader.split(" ")[1];

      if (!token) {
        return res.status(401).json({
          message: "Unauthorized Access",
        });
      }

      try {
        const { payload } = await jwtVerify(token, JWKS);

        req.user = payload;

        return next();
      } catch (error) {
        // console.error("JWT verification failed:", error);

        return res.status(401).json({
          message: "Unauthorized Access",
        });
      }
    };
    await client.connect();

    // console.log("You successfully connected to MongoDB!");

    app.post("/recipes", async (req, res) => {
      const newRecipe = { ...req.body, likes: 0 };

      const result = await recipes.insertOne(newRecipe);
      res.send(result);
    });
    app.delete("/reported-recipe/data/:id", async (req, res) => {
      const { id } = req.params;
      // console.log(id);
      const result = await reportRecipes.deleteOne({
        recipeId: id,
      });
      // console.log(result);
      res.send(result);
    });
    app.delete("/reported-recipe/data-delete/:id", async (req, res) => {
      const { id } = req.params;
      // console.log(id);
      const result = await recipes.deleteOne({
        _id: new ObjectId(id),
      });
      // console.log(result);
      res.send(result);
    });
    app.get("/reported-recipe/data", async (req, res) => {
      const reportsData = await reportRecipes.find().toArray();

      const reportedIds = reportsData.map(
        (report) => new ObjectId(report.recipeId),
      );

      const findRecipe = await recipes
        .find({
          _id: { $in: reportedIds },
        })
        .toArray();

      const mergedData = reportsData.map((report) => {
        const recipe = findRecipe.find(
          (recipe) => recipe._id.toString() === report.recipeId,
        );

        return {
          ...report,
          recipe,
        };
      });

      res.send(mergedData);
    });

    app.get("/recipes/find/:id", async (req, res) => {
      const id = req.params.id;

      const recipe = await recipes.findOne({
        _id: new ObjectId(id),
      });
      res.send(recipe);
    });

    app.patch("/recipes/find/:id", async (req, res) => {
      await recipes.updateMany({}, [
        {
          $set: {
            likes: {
              $convert: {
                input: "$likes",
                to: "int",
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      ]);
      const id = req.params.id;

      const recipe = await recipes.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $inc: {
            likes: 1,
          },
        },
      );
      res.send(recipe);
    });

    app.patch("/recipe/manage/:id", async (req, res) => {
      const recipeId = req.params.id;
      // console.log(recipeId, "this is recipe id from backend");
      const recipe = await recipes.findOne({
        _id: new ObjectId(recipeId),
      });

      if (!recipe) {
        return res.status(404).json({
          message: "Recipe not found",
        });
      }

      const newStatus =
        recipe.isFeatured === "Featured" ? "Regular" : "Featured";

      await recipes.updateOne(
        { _id: new ObjectId(recipeId) },
        {
          $set: {
            isFeatured: newStatus,
          },
        },
      );

      return res.send({
        isFeatured: newStatus,
      });
    });

    app.post("/recipes/savedrecipe", async (req, res) => {
      const recipe = await savedRecipes.insertOne(req.body);

      res.send(recipe);
    });
    app.get("/recipes/savedrecipe/:email", authenticate, async (req, res) => {
      const email = req.params.email;
      console.log(email, "this is email from backend");

      const favoriteRecipe = await savedRecipes
        .find({
          userEmail: email,
        })
        .toArray();

      const recipeId = favoriteRecipe
        .filter((recipe) => ObjectId.isValid(recipe.recipeId))
        .map((recipe) => new ObjectId(recipe.recipeId));

      const result = await recipes
        .find({
          _id: { $in: recipeId },
        })
        .toArray();

      console.log(recipeId, "this is result");

      res.send(result);
    });
    app.delete("/recipes/savedrecipe/:id", async (req, res) => {
      const { id } = req.params;

      const unsaveRecipe = await savedRecipes.deleteOne({
        recipeId: id,
      });

      res.send(unsaveRecipe);
    });

    app.post("/recipehub/report", async (req, res) => {
      const data = req.body;
      const report = await reportRecipes.insertOne(data);
      res.send(report);
    });
    app.get("/recipehub/report", async (req, res) => {
      const report = await reportRecipes.find().toArray();
      res.send(report);
    });

    app.get("/recipes", async (req, res) => {
      const search = req.query.search;
      const category = req.query.category;
      const cuisine = req.query.cuisine;

      let query = {};

      if (search) {
        query = {
          title: {
            $regex: search,
            $options: "i",
          },
        };
      }
      if (category) {
        query = {
          category: {
            $regex: category,
            $options: "i",
          },
        };
      }
      if (cuisine) {
        query = {
          cuisine: {
            $regex: cuisine,
            $options: "i",
          },
        };
      }

      if (req.query.page) {
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.perPage) || 8;
        const skipItems = (page - 1) * perPage;

        const cursor = recipes.find(query).skip(skipItems).limit(perPage);
        const recipe = await cursor.toArray();
        return res.send(recipe);
      }
      const result = await recipes.find(query).toArray();
      res.send(result);
    });
    app.get("/recipes/user/:email", async (req, res) => {
      const authorEmail = req.params.email;

      const allRecipes = await recipes
        .find({
          authorEmail: authorEmail,
        })
        .toArray();

      res.send(allRecipes);
    });

    app.get("/purchased/recipes/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email, "this is email from backend2");
      const allTx = await transactions.find({ userEmail: email }).toArray();
      console.log(allTx, "this is all transaction from backend");
      const premiumRecipes = allTx.filter(
        (tx) => tx.product === "premium_recipe",
      );

      const recipeIds = premiumRecipes.map((tx) => new ObjectId(tx.recipeId));

      const purchasedRecipes = await recipes
        .find({
          _id: { $in: recipeIds },
        })
        .toArray();
      //  const myPurchasedRecipes = purchasedRecipes.filter(recipe => recipe.)

      res.send(purchasedRecipes);
    });

    app.get("/recipehub/users", async (req, res) => {
      const allUsers = await users.find().toArray();

      res.send(allUsers);
    });
    app.get("/premium/transaction", async (req, res) => {
      const tx = await transactions.find().toArray();

      res.send(tx);
    });

    app.patch("/users/role/:id", async (req, res) => {
      const userId = req.params.id;
      const isBlocked = req.body.newStatus;

      const updatedUser = await users.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            isBlocked: isBlocked,
          },
        },
      );

      res.send(updatedUser);
    });

    app.get("/recent/recipes/:email", async (req, res) => {
      const email = req.params?.email;
      const recentRecipes = recipes
        .find({
          authorEmail: email,
        })
        .sort({ createdAt: -1 })
        .limit(3);
    });
    return client;
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }
}

// Call this only when your application terminates
async function disconnectFromMongoDB() {
  await client.close();
}

app.get("/", (req, res) => {
  res.send("Hello World!");
});

connectToMongoDB().then(() => {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
});
connectToMongoDB();
module.exports = app;

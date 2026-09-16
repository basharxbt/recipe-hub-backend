const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const { MongoClient, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
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

console.log("Mongo URI exists:", !!process.env.MONGODB_URI);

const client = new MongoClient(uri);
const database = client.db("RecipeDB");
const recipes = database.collection("Recipes");
const savedRecipes = database.collection("SavedRecipes");
const reportRecipes = database.collection("reportRecipes");
const users = database.collection("user");

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");

    app.post("/recipes", async (req, res) => {
      const newRecipe = { ...req.body, Likes: 0 };
      // console.log("New recipe received:", newRecipe);
      const result = await recipes.insertOne(newRecipe);
      res.send(result);
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

    app.post("/recipes/savedrecipe", async (req, res) => {
      const recipe = await savedRecipes.insertOne(req.body);

      res.send(recipe);
    });
    app.get("/recipes/savedrecipe/:email", async (req, res) => {
      const email = req.params.email;

      const favoriteRecipe = await savedRecipes
        .find({
          userEmail: email,
        })
        .toArray();

      res.send(favoriteRecipe);
    });
    app.delete("/recipes/savedrecipe/:id", async (req, res) => {
      const { id } = req.params;

      const unsaveRecipe = await savedRecipes.deleteOne({
        _id: id,
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

    // app.get("/recipes", async (req, res) => {
    //   const allRecipes = await recipes.find().toArray();
    //   res.send(allRecipes);
    // });

    app.get("/recipes", async (req, res) => {
      const search = req.query.search;

      let query = {};

      if (search) {
        query = {
          title: {
            $regex: search,
            $options: "i",
          },
        };
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

    app.get("/recipehub/users", async (req, res) => {
      const allUsers = await users.find().toArray();

      res.send(allUsers);
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
module.exports = { connectToMongoDB, disconnectFromMongoDB };

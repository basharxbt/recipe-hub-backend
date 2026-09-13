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

const client = new MongoClient(uri);
const database = client.db("RecipeDB");
const recipes = database.collection("Recipes");
const savedRecipes = database.collection("SavedRecipes");
const reportRecipes = database.collection("reportRecipes");

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
      // console.log(id);

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
      // console.log(id, "jjjjjjjj");

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
      // console.log(recipe);
      res.send(recipe);
    });
    app.get("/recipes/savedrecipe/:email", async (req, res) => {
      console.log(req.params);
      const email = req.params.email;
      console.log(email, "this is email");
      const favoriteRecipe = await savedRecipes
        .find({
          userEmail: email,
        })
        .toArray();
      // console.log(favoriteRecipe, "this is favorite");
      res.send(favoriteRecipe);
    });
    app.delete("/recipes/savedrecipe/:id", async (req, res) => {
      const { id } = req.params;
      console.log("id from params:", id, typeof id);
      const unsaveRecipe = await savedRecipes.deleteOne({
        _id: id,
      });
      console.log(unsaveRecipe);
      res.send(unsaveRecipe);
    });

    app.post("/recipes/report", async (req, res) => {
      const data = req.body;
      const report = await reportRecipes.insertOne(data);
      res.send(report);
    });

    app.get("/recipes", async (req, res) => {
      const allRecipes = await recipes.find().toArray();
      res.send(allRecipes);
    });

    return client;
  } catch (err) {
    // console.dir(err);
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

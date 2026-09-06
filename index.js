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

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");

    app.post("/recipes", async (req, res) => {
      const newRecipe = { ...req.body, Likes: 0 };
      console.log("New recipe received:", newRecipe);
      const result = await recipes.insertOne(newRecipe);
      res.send(result);
    });
    app.get("/recipes/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);

      const recipe = await recipes.findOne({
        _id: new ObjectId(id),
      });
      res.send(recipe);
    });

    app.patch("/recipes/:id", async (req, res) => {
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
      console.log(id, "jjjjjjjj");

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

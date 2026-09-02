const { MongoClient } = require("mongodb");
const express = require("express");
const app = express();
const port = 3100;
require("dotenv").config();

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri);
const database = client.db("RecipeDB");
const recipes = database.collection("Recipes");

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
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

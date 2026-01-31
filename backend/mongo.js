const mongoose = require("mongoose");

async function connectMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn("[mongo] MONGO_URI manquant -> NoSQL désactivé");
    return false;
  }
mongoose.set("bufferCommands", false);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log("[mongo] connecté");
    return true;
  } catch (e) {
    console.warn("[mongo] connexion impossible -> NoSQL désactivé :", e.message);
    return false;
  }
}

module.exports = { connectMongo };

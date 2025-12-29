import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async function () {
    try {
        await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`)
        console.log("✅ MongoDB Connected Sucessfully!");
    } catch (error) {
        console.error("❌ MongoDB Connection Error",error); 
        process.exit(1)
    }
};

export default connectDB
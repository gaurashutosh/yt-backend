import dotenv from "dotenv"
import express from "express"
import connectDB from "./db/DBconn.js"
dotenv.config({
    path:"./.env"
})
connectDB()

const app = express()

const port = 3000 || process.env.PORT 

app.listen(port,()=>{
    console.log(`The server is listening at http://localhost:${port}`);
})
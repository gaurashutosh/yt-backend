import dotenv from "dotenv";
import { app } from "./app.js";
import connectDB from "./db/DBconn.js";
dotenv.config({
  path: "./.env",
});

const port = 3000 || process.env.PORT;
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`The server is listening at http://localhost:${port}`);
  });
});

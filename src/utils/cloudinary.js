import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async function (localFilePath, folderName) {
  try {
    if (!localFilePath) return console.log(`Path of the file is not provided!`);

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: folderName,
    });
    
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath);
  }
};

export { uploadOnCloudinary };

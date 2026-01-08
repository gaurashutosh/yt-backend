import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "./apiError.js";

const oldImageDelete = async function (oldImagePublicId) {
  try {
    const deleteResponse = await cloudinary.uploader.destroy(oldImagePublicId, {
      resource_type: "image",
    });

    return deleteResponse;
  } catch (error) {
    throw new ApiError(
      500,
      error.message || "Something Went Wrong While Deleting The Old Image"
    );
  }
};

export { oldImageDelete };

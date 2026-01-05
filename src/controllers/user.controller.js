import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
  const { username, fullName, email, password } = req.body;

  if (!username) {
    throw new ApiError(400, "Username is required");
  }
  if (!fullName) {
    throw new ApiError(400, "Fullname is required!");
  }
  if (!email) {
    throw new ApiError(400, "Email is required!");
  }
  if (!password) {
    throw new ApiError(400, "Password is required!");
  }

  const existedUser = await User.findOne({ email });

  if (existedUser) {
    throw new ApiError(409, "User with this email already exists! ");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Please provide image for avatar!");
  }

  const avatar = await uploadOnCloudinary(
    avatarLocalPath,
    `yt-backend/users/${username}/`
  );

  const coverImage = await uploadOnCloudinary(
    coverImageLocalPath,
    `yt-backend/users/${username}/`
  );

  if (!avatar) {
    throw new ApiError(400, "Please provide image for avatar!");
  }

  const user = await User.create({
    email: email,
    username: username.toLowerCase(),
    fullName: fullName,
    password: password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken "
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while creating account");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "Account created successfully!"));
});

export { registerUser };

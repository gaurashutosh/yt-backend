import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
  //create user object create entry in to the db
  //remove password and refresh token field from response
  //check for user4 creation
  //return res

  const { username, fullName, email, password } = req.body;

  if (!username || !fullName || !email || !password) {
    res.status(400).json(new ApiError(400, "Required field is missing!"));
  }

  const existedUser = User.findOne(email);
  if (existedUser) {
    res
      .status(409)
      .json(new ApiError(409, "User with this email already exists! "));
  }

  const avatarLocalPath = req.files?.avatar[0].path;
  const coverImageLocalPath = req.files?.coverImage[0].path;

  if (!avatarLocalPath) {
    res.status(400).json(new ApiError(409, "Please provide image for avatar!"));
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    res.status(400).json(new ApiError(400, "Please provide image for avatar!"));
  }

  const user = await User.create({
    email: email,
    username: username.toLowerCase(),
    fullName: fullName,
    password: password,
    avatar: avatar.url,
    coverImage: coverImage.url || ""
  });

  const createdUser = await User.findById(user._id).select(
    "- password -refreshToken "
  )

  if (!createdUser) {
    res.status(500).json(new ApiError(409,"Something went wrong while creating account"))
  }

  return res.status(201).json(new ApiResponse(200,createdUser,"Account created successfully!"))
});

export { registerUser };

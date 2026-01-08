import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import { oldImageDelete } from "../utils/oldImageDelete.js";
import fs from "fs"

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

  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

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
    avatar: {
      url: avatar.url,
      publicId: avatar.public_id || "",
    },
    coverImage: {
      url: coverImage.url,
      publicId: coverImage.public_id || "",
    },
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

const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!(username || email) || !password) {
    throw new ApiError(400, "Please provide credentials for login ");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(
      404,
      "User with the following credentials does not exist!"
    );
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials!");
  }

  const { refreshToken, accessToken } = await generateRefreshAndAccessToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = { httpOnly: true, secure: true };
  return res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully!"
      )
    );
});

const generateRefreshAndAccessToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      error ||
        "Something went wrong while generating access token and refresh token!"
    );
  }
};

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, "User Logged Out Successfully!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
      throw new ApiError(400, "Invalid Refresh Token!");
    }

    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(400, "Unauthorized Request: User Not Found!");
    }
    const { accessToken, refreshToken } = await generateRefreshAndAccessToken(
      decodedToken._id
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    res
      .status(200)
      .cookie(refreshToken, "refreshToken", options)
      .cookie(accessToken, "accessToken", options)
      .json(
        new ApiResponse(
          200,
          { refreshToken, accessToken },
          "Tokens Refreshed Successfully!"
        )
      );
  } catch (error) {
    throw new ApiError(500, error?.message || "Internal Server Error");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordValid = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordValid) {
      throw new ApiError(400, "Please Provide The Correct Old Password");
    }
    user.password = newPassword;
    user.save({ validateBeforeSave: false });

    res
      .status(200)
      .json(new ApiResponse(200, {}, "Password Updated Successfully"));
  } catch (error) {
    throw new ApiError(500, error || "Internal Server Error");
  }
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully!"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "Please Provide Name Or Email To Update!");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { fullName: fullName, email: email },
    },
    { new: true }
  ).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(400, "Error While Updating The Account Details!");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully!"));
});

const updateAvatar = asyncHandler(async (req, res) => {
  const username = req.user?.username;
  const avatarLocalPath = req.file?.path;
 const oldAvatarPublicId = req.user?.avatar?.publicId

  if (!avatarLocalPath) {
    throw new ApiError(400, "Please Provide Avatar!");
  }

  const avatar = await uploadOnCloudinary(
    avatarLocalPath,
    `yt-backend/users/${username}/`
  );

  if (!avatar) {
    throw new ApiError(400, "Error While Uplaoding The Avatar!");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: {
          url: avatar.url,
          publicId: avatar.public_id,
        },
      },
    },
    { new: true }
  ).select("-password");

  if (!user) {
    throw new ApiError(400, "Error While Updating The Avatar!");
  }

  if (req.user.avatar.publicId) {
    await oldImageDelete(req.user.avatar.publicId);
    if (!oldImageDelete) {
      throw new ApiError(400, "Error While Deleting Old Avatar Pic!");
    }
  }else{
    throw new ApiError(400, "Error While Deleting The Old Avatar!");
  }
  // const unlink = fs.unlinkSync(avatarLocalPath)
  // console.log("Unlink??---->",unlink);
  
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar Updated Successfully! "));
});



const updateCoverImage = asyncHandler(async (req, res) => {
  const username = req.user?.username;
  const coverImageLocalPath = req.file?.path;
 const oldCoverImagePublicId = req.user?.coverImage?.publicId

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Please Provide Cover Image!");
  }

  const coverImage = await uploadOnCloudinary(
    coverImageLocalPath,
    `yt-backend/users/${username}/`
  );

  if (!coverImage) {
    throw new ApiError(400, "Error While Uplaoding The Cover Image!");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: {
          url: coverImage.url,
          publicId: avatar.public_id,
        },
      },
    },
    { new: true }
  ).select("-password");

  if (!user) {
    throw new ApiError(400, "Error While Updating The Cover Image!");
  }

  if (req.user.coverImage.publicId) {
    await oldImageDelete(req.user.coverImage.publicId);
    if (!oldImageDelete) {
      throw new ApiError(400, "Error While Deleting Old Cover Image!");
    }
  }else{
    throw new ApiError(400, "Error While Deleting The Old Cover Image!");
  }
  fs.unlinkSync(coverImageLocalPath)

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image Updated Successfully! "));
});

const deleteUser = asyncHandler(async (req, res) => {
  const fullName = req.user.fullName;
  const user = await User.findByIdAndDelete(req.user._id);
  if (!user) {
    throw new ApiError(400, "Something Went Wrong While Deleting User! ");
  }
  const options = {
    httpOnly: true,
    secure: true,
  };
  res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, `User ${fullName} Deleted Successfully!`));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
  deleteUser,
};

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

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
  const options = { HttpOnly: true, secure: true };
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
    HttpOnly: true,
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
      HttpOnly: true,
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
    /**
     * verify the user is loggedin by middleware
     * Take old password and the new password from the user
     * find the user in the database
     * verify the given old pass from the database password
     * if it is correct update the password field
     */

    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    
    const isPasswordValid = await user.isPasswordCorrect(oldPassword);
    console.log("isPasswordValid: ",isPasswordValid);
    
    if (!isPasswordValid) {
      throw new ApiError(400, "Please Provide The Correct Old Password");
    }
    user.password = newPassword
    user.save({validateBeforeSave:false})

    res.status(200).json(new ApiResponse(200,{},"Password Updated Successfully"))
  } catch (error) {
    throw new ApiError(500, error || "Internal Server Error");
  }
});



export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword};

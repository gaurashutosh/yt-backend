import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
  {
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    username: {
      type: String,
      required: [true, "Please provide username!"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true, // optimised way for searching
    },
    email: {
      type: String,
      required: [true, "Please provide username!"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, "Please provide full name!"],
      index: true,
    },
    avatar: {
      type: String,
    },
    coverImage: {
      type: String,
    },
    password: {
      type: String,
      required: [true, "Please provide password!"],
    },
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = bcrypt.hash(this.password, 10);
    next();
  }
});

userSchema.methods.isPasswordCorrect(async function (password) {
  return await bcrypt.compare(password, this.password);
});

userSchema.methods.generateAccessToken(function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      username: this.username,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_SECRET }
  );
});
userSchema.methods.generateRefreshToken(function () {
  return jwt.sign(
    {
      id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_SECRET }
  );
});

export const User = mongoose.model("User", userSchema);

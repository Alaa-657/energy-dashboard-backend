const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true, // Remove leading/trailing spaces
        minlength: 3 // Ensure at least 3 characters
    },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true,
        lowercase: true, // Store emails in lowercase
        match: [/^\S+@\S+\.\S+$/, "Bitte eine gültige E-Mail-Adresse eingeben"] // Email validation
    },
    password: { 
        type: String, 
        required: true,
        minlength: 6 // Ensure passwords are at least 6 characters long
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model("User", UserSchema);

const jwt = require("jsonwebtoken");
require("dotenv").config();  // ✅ Load .env variables

module.exports = function (req, res, next) {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
        console.error("❌ Kein Token gesendet!");
        return res.status(401).json({ message: "Kein Token, Zugriff verweigert" });
    }

    try {
        let token = authHeader;

        // ✅ Support both "Bearer TOKEN" and "TOKEN" formats
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1]; // Extract only the token
        }

        // ✅ Use .env for the secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);


        console.log("🔍 Decoded Token:", decoded); // ✅ Debugging: Check entire payload

        // ✅ Ensure `userId` exists in the decoded token
        if (!decoded.userId) {
            console.error("❌ Token enthält keine Benutzer-ID!");
            return res.status(401).json({ message: "Ungültiges Token" });
        }

        req.user = decoded; // Attach decoded user data
        console.log("✅ Token validiert, User ID:", req.user.userId);
        next();
    } catch (error) {
        console.error("❌ Token-Fehler:", error.message);
        res.status(401).json({ message: "Ungültiges Token" });
    }
};

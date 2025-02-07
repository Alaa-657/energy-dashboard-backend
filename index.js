const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const cors = require("cors");
const mongoose = require("mongoose");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");
require("dotenv").config();


const User = require("./models/User");
const Investment = require("./models/Investment");
const auth = require("./middleware/auth");

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));



app.get("/", (req, res) => res.send("Backend is running!"));



// ===================== USER AUTHENTICATION =====================

// ✅ REGISTER USER
app.post("/api/auth/register", [
    check("username", "Benutzername ist erforderlich").not().isEmpty(),
    check("email", "Bitte eine gültige E-Mail eingeben").isEmail(),
    check("password", "Passwort muss mindestens 6 Zeichen lang sein").isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { username, email, password } = req.body;

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "E-Mail wird bereits verwendet" });

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ username, email, password: hashedPassword });
        await user.save();

        res.json({ message: "Registrierung erfolgreich" });

    } catch (error) {
        console.error("❌ Registration Error:", error);
        res.status(500).json({ message: "❌ Serverfehler bei der Registrierung" });
    }
});

// ✅ LOGIN USER
app.post("/api/auth/login", [
    check("email", "Bitte eine gültige E-Mail eingeben").isEmail(),
    check("password", "Passwort ist erforderlich").exists()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log("Validation Error:", errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        console.log("Login attempt with:", req.body); // ✅ Log request data

        const { email, password } = req.body;
        let user = await User.findOne({ email });

        if (!user) {
            console.log("User not found for email:", email); // ✅ Debugging
            return res.status(400).json({ message: "Ungültige Anmeldeinformationen" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log("Invalid password for user:", email); // ✅ Debugging
            return res.status(400).json({ message: "Ungültige Anmeldeinformationen" });
        }

        // Generate JWT Token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        console.log("Login successful! Token generated."); // ✅ Debugging
        res.json({ token });

    } catch (error) {
        console.error("🔥 Server Error:", error); // ✅ Log the real error
        res.status(500).json({ message: "Serverfehler" });
    }
});


// ===================== INVESTMENT MANAGEMENT =====================

// ✅ CREATE INVESTMENT (User-Specific)
app.post("/api/investments", auth, async (req, res) => {
    try {
        const { projectName, amountInvested, energyGenerated, returns } = req.body;
        const newInvestment = new Investment({
            userId: req.user.userId,
            projectName,
            amountInvested,
            energyGenerated,
            returns
        });
        await newInvestment.save();
        res.json(newInvestment);
    } catch (error) {
        res.status(500).json({ error: "Fehler beim Speichern der Investition" });
    }
});

// ✅ GET INVESTMENTS (User-Specific)
app.get("/api/investments", auth, async (req, res) => {
    try {
        console.log("Checking Investments for User ID:", req.user.userId);

        // Convert userId to ObjectId to match MongoDB format
        const userId = new mongoose.Types.ObjectId(req.user.userId);

        const investments = await Investment.find({ userId });

        console.log("Found Investments:", investments);
        res.json(investments);
    } catch (error) {
        console.error("Error fetching investments:", error);
        res.status(500).json({ error: "Fehler beim Abrufen der Investitionen" });
    }
});

// ✅ DELETE INVESTMENT (User-Specific)
app.delete("/api/investments/:id", auth, async (req, res) => {
    try {
        const deletedInvestment = await Investment.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
        if (!deletedInvestment) return res.status(404).json({ message: "Investition nicht gefunden." });
        res.json({ message: "Investition erfolgreich gelöscht." });
    } catch (error) {
        res.status(500).json({ message: "Fehler beim Löschen der Investition." });
    }
});

// ✅ UPDATE INVESTMENT (User-Specific)
app.put("/api/investments/:id", auth, async (req, res) => {
    try {
        const updatedInvestment = await Investment.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            req.body,
            { new: true }
        );
        if (!updatedInvestment) return res.status(404).json({ message: "Investition nicht gefunden." });
        res.json(updatedInvestment);
    } catch (error) {
        res.status(500).json({ message: "Fehler beim Bearbeiten der Investition." });
    }
});

// ===================== EXPORT FUNCTIONALITY =====================


// ✅ EXPORT AS CSV (User-Specific)
app.get("/api/export/csv", auth, async (req, res) => {
    try {
        console.log("📌 CSV Export - User ID:", req.user.userId); // Debugging

        const investments = await Investment.find({ userId: req.user.userId });

        if (!investments.length) {
            return res.status(404).json({ message: "Keine Investitionen gefunden." });
        }

        const fields = ["projectName", "amountInvested", "energyGenerated", "returns"];
        const parser = new Parser({ fields });
        const csv = parser.parse(investments);

        res.header("Content-Type", "text/csv");
        res.attachment("Investitionen.csv");
        res.send(csv);
    } catch (error) {
        console.error("❌ CSV Export Error:", error);
        res.status(500).json({ message: "Fehler beim Exportieren als CSV." });
    }
});



// ✅ EXPORT AS PDF (User-Specific)
app.get("/api/export/pdf", auth, async (req, res) => {
    try {
        console.log("📌 PDF Export - User ID:", req.user.userId); // Debugging

        const investments = await Investment.find({ userId: req.user.userId });

        if (!investments.length) {
            return res.status(404).json({ message: "Keine Investitionen gefunden." });
        }

        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=Investitionen.pdf");

        doc.pipe(res);
        doc.fontSize(20).text("Erneuerbare Investitionen Bericht", { align: "center" });
        doc.moveDown();

        investments.forEach((inv, index) => {
            doc.fontSize(12).text(`${index + 1}. ${inv.projectName}`);
            doc.text(`Investiert: ${inv.amountInvested} €`);
            doc.text(`Erzeugt: ${inv.energyGenerated} kWh`);
            doc.text(`Rendite: ${inv.returns}%`);
            doc.moveDown();
        });

        doc.end();
    } catch (error) {
        console.error("❌ PDF Export Error:", error);
        res.status(500).json({ message: "Fehler beim Exportieren als PDF." });
    }
});


// ✅ GET User Profile (User-Specific)
app.get("/api/user/profile", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select("-password"); // Exclude password from response
        if (!user) return res.status(404).json({ message: "Benutzer nicht gefunden." });

        res.json(user); // Send user data to frontend
    } catch (error) {
        console.error("❌ Fehler beim Abrufen des Benutzerprofils:", error);
        res.status(500).json({ message: "Fehler beim Abrufen des Benutzerprofils." });
    }
});

// ✅ UPDATE User Profile (User-Specific)
app.put("/api/user/update", auth, async (req, res) => {
    try {
        const { username, email, newPassword } = req.body;
        const userId = req.user.userId;

        let updateFields = { username, email };

        // ✅ Hash new password if provided
        if (newPassword && newPassword.trim() !== "") {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            updateFields.password = hashedPassword;
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updateFields, { new: true }).select("-password");

        if (!updatedUser) return res.status(404).json({ message: "Benutzer nicht gefunden." });

        res.json({ message: "✅ Profil erfolgreich aktualisiert!", user: updatedUser });
    } catch (error) {
        console.error("❌ Fehler beim Aktualisieren des Profils:", error);
        res.status(500).json({ message: "❌ Fehler beim Aktualisieren des Profils." });
    }
});




// ===================== SERVER START =====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

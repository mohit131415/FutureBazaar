const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const bodyParser = require("body-parser")
const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(bodyParser.json())

// MongoDB connection - use environment variable in production
const MONGODB_URI = "mongodb+srv://helloworldabaa:ULw4tqFta92Mba4@cluster0.dq5ts.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Market Schema
const marketSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Please provide a title for this market"],
    maxlength: [100, "Title cannot be more than 100 characters"],
  },
  description: {
    type: String,
    required: false,
  },
  probability: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 50,
  },
  volume: {
    type: String,
    required: true,
    default: "$0",
  },
  endDate: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ["Politics", "Crypto", "Sports", "Entertainment", "Science", "Economics"],
  },
  isResolved: {
    type: Boolean,
    default: false,
  },
  change: {
    type: Number,
    default: 0,
  },
  traders: {
    type: Number,
    default: 0,
  },
  resolutionDetails: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

const Market = mongoose.model("Market", marketSchema)

// Simple authentication
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123"
const validTokens = new Set()

function generateToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"]
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const token = authHeader.substring(7)
  if (!validTokens.has(token)) {
    return res.status(401).json({ message: "Invalid token" })
  }

  next()
}

// Routes
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = generateToken()
    validTokens.add(token)
    return res.status(200).json({ token })
  }

  return res.status(401).json({ message: "Invalid credentials" })
})

app.get("/api/admin/validate", authenticateToken, (req, res) => {
  res.status(200).json({ valid: true })
})

// Markets CRUD
app.get("/api/admin/markets", authenticateToken, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    // Build query
    const query = {}

    // Add search filter if provided
    if (req.query.search) {
      query.title = { $regex: req.query.search, $options: "i" }
    }

    // Add category filter if provided
    if (req.query.category && req.query.category !== "all") {
      query.category = req.query.category
    }

    // Get total count for pagination
    const total = await Market.countDocuments(query)

    // Get markets with pagination
    const markets = await Market.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)

    return res.status(200).json({
      markets,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("Error fetching markets:", error)
    return res.status(500).json({ message: "Error fetching markets" })
  }
})

app.post("/api/admin/markets", authenticateToken, async (req, res) => {
  try {
    const marketData = req.body

    // Validate required fields
    if (!marketData.title || !marketData.category || !marketData.endDate) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    // Create new market
    const market = new Market(marketData)
    await market.save()

    return res.status(201).json(market)
  } catch (error) {
    console.error("Error creating market:", error)
    return res.status(500).json({ message: "Error creating market" })
  }
})

app.get("/api/admin/markets/:id", authenticateToken, async (req, res) => {
  try {
    const market = await Market.findById(req.params.id)

    if (!market) {
      return res.status(404).json({ message: "Market not found" })
    }

    return res.status(200).json(market)
  } catch (error) {
    console.error("Error fetching market:", error)
    return res.status(500).json({ message: "Error fetching market" })
  }
})

app.put("/api/admin/markets/:id", authenticateToken, async (req, res) => {
  try {
    const marketData = req.body

    // Validate required fields
    if (!marketData.title || !marketData.category || !marketData.endDate) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    // Update market
    const market = await Market.findByIdAndUpdate(
      req.params.id,
      { ...marketData, updatedAt: Date.now() },
      { new: true, runValidators: true },
    )

    if (!market) {
      return res.status(404).json({ message: "Market not found" })
    }

    return res.status(200).json(market)
  } catch (error) {
    console.error("Error updating market:", error)
    return res.status(500).json({ message: "Error updating market" })
  }
})

app.delete("/api/admin/markets/:id", authenticateToken, async (req, res) => {
  try {
    const market = await Market.findByIdAndDelete(req.params.id)

    if (!market) {
      return res.status(404).json({ message: "Market not found" })
    }

    return res.status(200).json({ message: "Market deleted successfully" })
  } catch (error) {
    console.error("Error deleting market:", error)
    return res.status(500).json({ message: "Error deleting market" })
  }
})

// Public API for fetching markets
app.get("/api/markets", async (req, res) => {
  try {
    const markets = await Market.find().sort({ createdAt: -1 }).limit(10)

    return res.status(200).json(markets)
  } catch (error) {
    console.error("Error fetching markets:", error)
    return res.status(500).json({ message: "Error fetching markets" })
  }
})

app.get("/api/markets/:id", async (req, res) => {
  try {
    const market = await Market.findById(req.params.id)

    if (!market) {
      return res.status(404).json({ message: "Market not found" })
    }

    return res.status(200).json(market)
  } catch (error) {
    console.error("Error fetching market:", error)
    return res.status(500).json({ message: "Error fetching market" })
  }
})

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  const path = require("path")
  app.use(express.static(path.resolve(__dirname, "../dist")))

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../dist", "index.html"))
  })
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})


import newman from "newman";
import path from "path";
import fs from "fs";
import { postmanTestData1 } from "./data/postman-test-1.js";
import { postmanTestData1Environment } from "./data/environment.js";

const __dirname = path.resolve();

// Ensure reports directory exists
const reportsDir = path.join(__dirname, "test-reports");
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Run the collection
newman
  .run({
    collection: postmanTestData1,
    environment: postmanTestData1Environment,
    reporters: ["cli", "htmlextra"],
    reporter: {
      htmlextra: {
        export: path.join(reportsDir, "telex-api-report.html"),
        browserTitle: "Telex API Test Report",
        title: "Telex Server Monitor API Tests",
        timezone: "UTC",
      },
    },
  })
  .on("start", () => {
    console.log("Starting Telex API tests");
  })
  .on("finish", () => {
    console.log("Telex API tests completed");
  });

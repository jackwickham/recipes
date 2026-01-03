import { app } from "./app.js";
import { loadConfig } from "./services/config.js";

const config = loadConfig();
const PORT = config.port || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
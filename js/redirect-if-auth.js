import { isAuthenticated } from "./security.js";

if (isAuthenticated()) {
  window.location.href = "index.html";
}

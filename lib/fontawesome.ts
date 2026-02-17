import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";

// Prevent Font Awesome from adding its CSS since we import it manually above.
// This avoids a large unstyled icon flash on page load.
config.autoAddCss = false;

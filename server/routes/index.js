const apiRoute = require("./ApiRoutes");

function routes(app) {
  app.use("/", apiRoute);
}
module.exports = routes;

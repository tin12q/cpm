const apiRoute = require("./ApiRoutes");

function routes(app) {
  app.use("/api", apiRoute);

}
module.exports = routes;

const service = require("../services/MyService");

module.exports = function(app) {
  app.get("/", function(req, res) {
    res.render("index");
  });

  app.post("/", function(req, res) {
    const body = req.body;
    // request asesrtion
    const locals = { body };
    service
      .search(req)
      .then(function(response) {
        locals.response = JSON.stringify(response);
        res.render("index", locals);
      }).catch(function(error) {
        locals.error = JSON.stringify(error);
        res.render("index", locals);
      });
  });
};

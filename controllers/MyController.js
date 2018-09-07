const service = require("../services/MyService");

module.exports = function(app) {
  app.get("/", function(req, res) {
    res.render("index");
  });

  app.post("/", function(req, res) {
    const body = req.body;
    const locals = { body };
    service.addTask(req)
      .then(function(response) {
        locals.status = response.status;
        res.render("accepted", locals);
      }).catch(function(error) {
        console.log('/(POST) error', error);
      });
  });

  app.get("/result", function(req, res) {
    service.getResultList(req).then(function(results) {
      res.render("result_list", { results });
    });
  });

  app.get("/result/:requestId", function(req, res) {
    const requestId = req.params.requestId;
    service.findResultDetail(req).then(function(result) {
      res.render("result_detail", { requestId, result });
    });
  });
};

const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const JWT = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server started and running at: http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();
//--------------------------------------------------------
const authenticateToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    JWT.verify(jwtToken, "BoomBoomShakaLaka", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

const convertDistrictParamsToCamalCase = (obj) => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  };
};

const convertStateParamsToCamalCase = (obj) => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  };
};
//--------------------------------------------------------

// Login API (1)
//POST http://localhost:3000/login/
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const dbUserQuery = `SELECT * FROM user 
                        WHERE username='${username}';`;
  const dbUser = await db.get(dbUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isSamePassword = await bcrypt.compare(password, dbUser.password);
    if (isSamePassword === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = JWT.sign(payload, "BoomBoomShakaLaka");
      response.send({ jwtToken });
    }
  }
});

// GET All States API (2)
//GET http://localhost:3000/states/
app.get("/states/", authenticateToken, async (request, response) => {
  const selectAllStatesQuery = `SELECT * FROM state;`;
  const allStatesArray = await db.all(selectAllStatesQuery);
  const convertedAllStatesArray = allStatesArray.map(
    convertStateParamsToCamalCase
  );
  response.send(convertedAllStatesArray);
});

// GET State by stateId API (3)
//GET http://localhost:3000/states/:stateId/
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const selectAllStatesQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const allStatesArray = await db.get(selectAllStatesQuery);
  response.send(convertStateParamsToCamalCase(allStatesArray));
});

// Add Disrtrict API (4)
//POST http://localhost:3000/districts/
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `INSERT INTO district 
                (district_name, state_id, cases, cured, active, deaths) 
                                  VALUES 
('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`;
  const dbResponse = await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

// GET District by districtId API (5)
//GET http://localhost:3000/districts/:districtId/
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const district = await db.get(getDistrictQuery);
    const convertedDistrict = convertDistrictParamsToCamalCase(district);
    response.send(convertedDistrict);
  }
);

// DELETE District by districtId API (6)
//DELETE http://localhost:3000/districts/:districtId/
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    const dbResponse = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// UPDATE District by districtId API (7)
//PUT http://localhost:3000/districts/:districtId/
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `UPDATE district SET district_name = '${districtName}',
                                                        state_id = ${stateId},
                                                        cases = ${cases},
                                                        cured = ${cured},
                                                        active = ${active},
                                                        deaths = ${deaths};`;
    const dbResponse = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// GET Statistics of State by stateId API (8)
//GET http://localhost:3000/states/:stateId/stats/
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getStatisticsQuery = `SELECT SUM(cases) as totalCases,
                                       SUM(cured) as totalCured,
                                       SUM(active) as totalActive,
                                       SUM(deaths) as totalDeaths
                                FROM district WHERE state_id = ${stateId};`;
    const statistics = await db.get(getStatisticsQuery);
    response.send(statistics);
  }
);
module.exports = app;

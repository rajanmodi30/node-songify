require("dotenv").config();
const fs = require("fs");
const ytdl = require("ytdl-core");
const search = require("youtube-search");
const { getVideoID } = require("ytdl-core");
const express = require("express");
const uuidv4 = require("uuid"); // I chose v4 ‒ you can select others
var cors = require("cors");
const environment = process.env.ENVIRONMENT;
var compression = require("compression");
var helmet = require("helmet");
const googleApiKey = process.env.YOUTUBE_KEY;
const port = process.env.PORT;
const ServerUrl =
  environment !== "production"
    ? process.env.SERVER_URL + ":" + port
    : process.env.SERVER_URL;
const mongoose = require("mongoose");
const ytsr = require("ytsr");

mongoose.connect("mongodb://localhost/node-song-app", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const app = express();
app.use(cors());
app.use("/media", express.static("media"));
app.use(compression());
app.use(helmet());

const db = mongoose.connection;

const SongsSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  path: {
    type: String,
    get: fetchUrl,
  },
});

const Song = mongoose.model("Songs", SongsSchema);

function fetchUrl(path) {
  return `${ServerUrl}/${path}`;
}
db.on("error", console.error.bind(console, "connection error:"));

db.once("open", function () {
  // we're connected!
});

const opts = {
  maxResults: 10,
  key: googleApiKey,
};

/**
 *  used for searching youtube
 */
app.get("/search/:searchParams", (req, res) => {
  let searchParams = req.params.searchParams;

  // const searchResults = ytsr(searchParams)
  //   .then((results) => res.json(results))
  //   .catch((err) => console.log(err));

  search(searchParams, opts, function (err, results) {
    if (err) return res.json(err);
    res.json(results);
  });
});

/**
 * downloads from the url provided
 */
app.get("/downloads", (req, res) => {
  let url = req.query.url;
  let songName = req.query.name;
  let filename = uuidv4.v4();
  let path = "media/" + filename + ".mp3";
  console.log("url", url);
  let stream = ytdl(url, { filter: "audioonly" }).pipe(
    fs.createWriteStream(path)
  );

  stream.on("finish", function () {
    const song = new Song({ name: songName, path: path });
    song
      .save()
      .then(() => {
        res.json({
          status: true,
          response: `${ServerUrl}/media/${filename}.mp3`,
        });
      })
      .catch(() => {
        res.json({
          status: false,
        });
      });
  });
});

/**
 *  returns the list of available songs
 */
app.get("/available/songs", (req, res) => {
  Song.find(
    function (err, songs) {
      if (err) return res.json({ status: false, songs: err });
      return res.json({ status: true, songs: songs });
    },
    { getters: true }
  );
});

/**
 * deletes a song
 */
app.get("/delete/:id", (req, res) => {
  let id = req.params.id;
  Song.remove({ _id: id })
    .then((result) => {
      return res.json({
        status: true,
        deleteCount: result.deletedCount,
      });
    })
    .catch((err) => {
      return res.json({
        status: false,
        err: err,
      });
    });
});

app.listen(port, () => {
  console.log(`Example app listening at ${ServerUrl}`);
});

import "./App.css";
import {
  FormControl,
  InputGroup,
  Container,
  Button,
  Card,
  Row,
} from "react-bootstrap";
import { useState, useEffect } from "react";

const clientId = import.meta.env.VITE_CLIENT_ID;
const clientSecret = import.meta.env.VITE_CLIENT_SECRET;

function App() {
  const [searchInput, setSearchInput] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [albums, setAlbums] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let authParams = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body:
        "grant_type=client_credentials&client_id=" +
        clientId +
        "&client_secret=" +
        clientSecret,
    };

    fetch("https://accounts.spotify.com/api/token", authParams)
      .then((result) => result.json())
      .then((data) => {
        setAccessToken(data.access_token);
        setStatus("");
      });
  }, []);

  async function search() {
    // prevent running before token is available or input is empty
    if (!accessToken) {
      // show a user-facing status and avoid spamming the console with an error
      setStatus("Waiting for Spotify token...");
      console.warn("search() called before access token was obtained");
      return;
    }

    if (!searchInput || searchInput.trim().length === 0) {
      return;
    }

    const artistParams = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
    };

    try {
      // Get Artist
      const artistResp = await fetch(
        "https://api.spotify.com/v1/search?q=" +
          encodeURIComponent(searchInput) +
          "&type=artist",
        artistParams
      );
      const artistData = await artistResp.json();

      const artist = artistData?.artists?.items?.[0];
      if (!artist) {
        console.warn("No artist found for:", searchInput);
        setAlbums([]);
        return;
      }

      const artistID = artist.id;

      // Get Artist Albums
      const albumsResp = await fetch(
        "https://api.spotify.com/v1/artists/" +
          artistID +
          "/albums?include_groups=album&market=US&limit=50",
        artistParams
      );
      const albumsData = await albumsResp.json();
      setAlbums(albumsData?.items || []);
    } catch (err) {
      console.error("Error while searching Spotify:", err);
      setAlbums([]);
    }
  }

  return (
    <>
      <Container>
        <InputGroup>
          <FormControl
            placeholder={accessToken ? "Search For Artist" : "Waiting for Spotify token..."}
            type="input"
            aria-label="Search for an Artist"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                // Only trigger search when we have a token and a non-empty input
                if (!accessToken) {
                  console.warn("Search blocked: access token not ready");
                  return;
                }
                if (!searchInput || searchInput.trim().length === 0) return;
                search();
              }
            }}
            onChange={(event) => setSearchInput(event.target.value)}
            style={{
              width: "300px",
              height: "35px",
              borderWidth: "0px",
              borderStyle: "solid",
              borderRadius: "5px",
              marginRight: "10px",
              paddingLeft: "10px",
            }}
          />
          <Button
            onClick={search}
            disabled={!accessToken || !searchInput || searchInput.trim().length === 0}
          >
            Search
          </Button>
        </InputGroup>
        {status && (
          <div style={{ color: "#666", marginTop: "8px", fontSize: "14px" }}>{status}</div>
        )}
      </Container>

      <Container>
        <Row
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-around",
            alignContent: "center",
          }}
        >
          {albums.map((album) => {
            return (
              <Card
                key={album.id}
                style={{
                  backgroundColor: "white",
                  margin: "10px",
                  borderRadius: "5px",
                  marginBottom: "30px",
                }}
              >
                <Card.Img
                  width={200}
                  src={album.images[0].url}
                  style={{
                    borderRadius: "4%",
                  }}
                />
                <Card.Body>
                  <Card.Title
                    style={{
                      whiteSpace: "wrap",
                      fontWeight: "bold",
                      maxWidth: "200px",
                      fontSize: "18px",
                      marginTop: "10px",
                      color: "black",
                    }}
                  >
                    {album.name}
                  </Card.Title>
                  <Card.Text
                    style={{
                      color: "black",
                    }}
                  >
                    Release Date: <br /> {album.release_date}
                  </Card.Text>
                  <Button
                    href={album.external_urls.spotify}
                    style={{
                      backgroundColor: "black",
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "15px",
                      borderRadius: "5px",
                      padding: "10px",
                    }}
                  >
                    Album Link
                  </Button>
                </Card.Body>
              </Card>
            );
          })}
        </Row>
      </Container>
    </>
  );
}

export default App;
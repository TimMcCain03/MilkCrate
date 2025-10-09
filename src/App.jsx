// ...existing code...
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

function App() {
  const [searchInput, setSearchInput] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [albums, setAlbums] = useState([]);
  const [status, setStatus] = useState("");

  // collection + UI state
  const [collection, setCollection] = useState([]);
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [formValues, setFormValues] = useState({
    owned: true,
    format: "Vinyl",
    condition: "Good",
    purchaseDate: "",
    notes: "",
  });

  useEffect(() => {
    // Request token from server endpoint
    fetch("/api/token")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.access_token) {
          setAccessToken(data.access_token);
          setStatus("");
        } else {
          console.error("Token endpoint returned unexpected response", data);
          setStatus("Unable to obtain Spotify token");
        }
      })
      .catch((err) => {
        console.error("Error fetching token from server:", err);
        setStatus("Unable to obtain Spotify token");
      });
  }, []);

  // load saved collection from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("myAlbumCollection");
      if (raw) setCollection(JSON.parse(raw));
    } catch (e) {
      console.warn("Failed to load collection from localStorage", e);
    }
  }, []);

  // persist collection
  useEffect(() => {
    try {
      localStorage.setItem("myAlbumCollection", JSON.stringify(collection));
    } catch (e) {
      console.warn("Failed to save collection to localStorage", e);
    }
  }, [collection]);

  async function search() {
    // prevent running before token is available or input is empty
    if (!accessToken) {
      setStatus("Waiting for Spotify token...");
      console.warn("search() called before access token was obtained");
      return;
    }

    if (!searchInput || searchInput.trim().length === 0) {
      return;
    }

    const params = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
    };

    try {
      const query = encodeURIComponent(searchInput);

      // search for both albums and artists in one request
      const searchResp = await fetch(
        `https://api.spotify.com/v1/search?q=${query}&type=album,artist&market=US&limit=50`,
        params
      );
      const searchData = await searchResp.json();

      // albums returned directly by the album search
      const albumsFromSearch = searchData?.albums?.items || [];

      // if an artist is found, also fetch that artist's albums
      let albumsFromArtist = [];
      const artist = searchData?.artists?.items?.[0];
      if (artist) {
        const artistID = artist.id;
        const albumsResp = await fetch(
          `https://api.spotify.com/v1/artists/${artistID}/albums?include_groups=album&market=US&limit=50`,
          params
        );
        const albumsData = await albumsResp.json();
        albumsFromArtist = albumsData?.items || [];
      }

      // Merge and dedupe albums by id (albumsFromSearch may overlap with albumsFromArtist)
      const merged = [...albumsFromSearch, ...albumsFromArtist];
      const map = new Map();
      merged.forEach((a) => {
        if (a && a.id && !map.has(a.id)) map.set(a.id, a);
      });
      const mergedAlbums = Array.from(map.values());

      if (mergedAlbums.length === 0) {
        console.warn("No albums or artists found for:", searchInput);
        setAlbums([]);
        return;
      }

      setAlbums(mergedAlbums);
    } catch (err) {
      console.error("Error while searching Spotify:", err);
      setAlbums([]);
    }
  }

  // open the full-page dropdown form to add album to collection
  function openAddToCollection(album) {
    setSelectedAlbum(album);
    setFormValues({
      owned: true,
      format: "Vinyl",
      condition: "Good",
      purchaseDate: "",
      notes: "",
    });
    setShowCollectionForm(true);
  }

  function closeCollectionForm() {
    setShowCollectionForm(false);
    setSelectedAlbum(null);
  }

  function saveToCollection(e) {
    e.preventDefault();
    if (!selectedAlbum) return;
    const entry = {
      id: selectedAlbum.id,
      name: selectedAlbum.name,
      artists: selectedAlbum.artists?.map((a) => a.name) || [],
      image: selectedAlbum.images?.[0]?.url || "",
      spotifyUrl: selectedAlbum.external_urls?.spotify || "",
      owned: formValues.owned,
      format: formValues.format,
      condition: formValues.condition,
      purchaseDate: formValues.purchaseDate,
      notes: formValues.notes,
      addedAt: new Date().toISOString(),
    };
    // avoid duplicates: replace existing entry with same id
    setCollection((prev) => {
      const filtered = prev.filter((i) => i.id !== entry.id);
      return [entry, ...filtered];
    });
    closeCollectionForm();
  }

  function updateFormField(field, value) {
    setFormValues((f) => ({ ...f, [field]: value }));
  }

  return (
    <>
      {/* Full-page dropdown / overlay form */}
      {showCollectionForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1050,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
          onClick={closeCollectionForm}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveToCollection}
            style={{
              marginTop: "6vh",
              width: "100%",
              maxWidth: 720,
              background: "white",
              borderRadius: 8,
              padding: 20,
              boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <img
                src={selectedAlbum?.images?.[0]?.url || ""}
                alt=""
                style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 6 }}
              />
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0 }}>{selectedAlbum?.name}</h4>
                <div style={{ color: "#666", fontSize: 14 }}>
                  {(selectedAlbum?.artists || []).map((a) => a.name).join(", ")}
                </div>
              </div>
              <button
                type="button"
                onClick={closeCollectionForm}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <hr />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                <div style={{ fontSize: 12, color: "#333" }}>Format</div>
                <select
                  value={formValues.format}
                  onChange={(e) => updateFormField("format", e.target.value)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option>Vinyl</option>
                  <option>CD</option>
                  <option>Digital</option>
                  <option>Cassette</option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                <div style={{ fontSize: 12, color: "#333" }}>Condition</div>
                <select
                  value={formValues.condition}
                  onChange={(e) => updateFormField("condition", e.target.value)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option>Mint</option>
                  <option>Near Mint</option>
                  <option>Very Good</option>
                  <option>Good</option>
                  <option>Fair</option>
                </select>
              </label>

              <label>
                <div style={{ fontSize: 12, color: "#333" }}>Purchase Date</div>
                <input
                  type="date"
                  value={formValues.purchaseDate}
                  onChange={(e) => updateFormField("purchaseDate", e.target.value)}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 12, color: "#333" }}>Owned?</div>
                <select
                  value={formValues.owned ? "yes" : "no"}
                  onChange={(e) => updateFormField("owned", e.target.value === "yes")}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "#333", marginBottom: 6 }}>Notes</div>
              <textarea
                value={formValues.notes}
                onChange={(e) => updateFormField("notes", e.target.value)}
                rows={4}
                style={{ width: "100%", padding: 8 }}
              />
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="light" onClick={closeCollectionForm}>
                Cancel
              </Button>
              <Button type="submit" style={{ backgroundColor: "black", color: "white" }}>
                Add to collection
              </Button>
            </div>
          </form>
        </div>
      )}

      <Container>
        <InputGroup>
          <FormControl
            placeholder={accessToken ? "Search For An Artist Or Album" : "Waiting for Spotify token..."}
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
        {/* small collection summary */}
        <div style={{ marginTop: 8, color: "#333", fontSize: 14 }}>
          My collection: {collection.length} album{collection.length === 1 ? "" : "s"}
        </div>
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
            const inCollection = collection.find((c) => c.id === album.id);
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
                  src={album.images?.[0]?.url || ""}
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
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      onClick={() => openAddToCollection(album)}
                      style={{
                        backgroundColor: inCollection ? "#2f855a" : "black",
                        color: "white",
                        fontWeight: "bold",
                        fontSize: "15px",
                        borderRadius: "5px",
                        padding: "10px",
                      }}
                    >
                      {inCollection ? "In collection" : "Add to collection"}
                    </Button>
                    <Button
                      href={album.external_urls?.spotify}
                      variant="outline-secondary"
                      style={{
                        borderRadius: "5px",
                        padding: "10px",
                      }}
                    >
                      Open on Spotify
                    </Button>
                  </div>
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
// ...existing code...
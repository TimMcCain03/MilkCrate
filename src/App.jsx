import "./App.css";
import {
  FormControl,
  InputGroup,
  Container,
  Button,
  Card,
  Row,
} from "react-bootstrap";
import { useState, useEffect, useCallback } from "react";

function App() {
  const [searchInput, setSearchInput] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [albums, setAlbums] = useState([]);
  const [status, setStatus] = useState("");
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
  const [showCollectionView, setShowCollectionView] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false); // New state

  // Fetch token and handle errors
  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch("/api/token");
      const data = await res.json();
      if (data?.access_token) {
        setAccessToken(data.access_token);
        setStatus("");
      } else {
        console.error("Token endpoint error:", data);
        setStatus("Unable to obtain Spotify token");
      }
    } catch (err) {
      console.error("Error fetching token:", err);
      setStatus("Unable to obtain Spotify token");
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Load/Save collection using useCallback
  const loadCollection = useCallback(() => {
    try {
      const raw = localStorage.getItem("myAlbumCollection");
      if (raw) setCollection(JSON.parse(raw));
    } catch (e) {
      console.warn("Load collection failed", e);
    }
  }, []);

  const saveCollection = useCallback(
    (newCollection) => {
      try {
        localStorage.setItem("myAlbumCollection", JSON.stringify(newCollection));
      } catch (e) {
        console.warn("Save collection failed", e);
      }
    },
    []
  );

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  useEffect(() => {
    saveCollection(collection);
  }, [collection, saveCollection]);

  // Consolidate album fetching
  const fetchAlbums = useCallback(
    async (query, accessToken) => {
      const params = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      };

      try {
        const searchResp = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album,artist&market=US&limit=50`,
          params
        );
        const searchData = await searchResp.json();

        const albumsFromSearch = searchData?.albums?.items || [];
        const artist = searchData?.artists?.items?.[0];
        let albumsFromArtist = [];

        if (artist) {
          const albumsResp = await fetch(
            `https://api.spotify.com/v1/artists/${artist.id}/albums?include_groups=album&market=US&limit=50`,
            params
          );
          const albumsData = await albumsResp.json();
          albumsFromArtist = albumsData?.items || [];
        }

        const mergedAlbums = Array.from(
          new Map(
            [...albumsFromSearch, ...albumsFromArtist].map((album) => [album.id, album])
          ).values()
        );

        if (mergedAlbums.length === 0) {
          console.warn("No albums/artists found:", query);
          return [];
        }

        return mergedAlbums;
      } catch (err) {
        console.error("Spotify search error:", err);
        return [];
      }
    },
    []
  );

  // Search function
  async function search() {
    if (!accessToken) {
      setStatus("Waiting for Spotify token...");
      console.warn("search() called before access token was obtained");
      return;
    }

    if (!searchInput || searchInput.trim().length === 0) {
      return;
    }

    const mergedAlbums = await fetchAlbums(searchInput, accessToken);
    setAlbums(mergedAlbums);
    setShowSearchResults(true); // Show results
  }

  // Collection form functions
  const openAddToCollection = useCallback(
    (album) => {
      setSelectedAlbum(album);
      setFormValues({
        owned: true,
        format: "Vinyl",
        condition: "Good",
        purchaseDate: "",
        notes: "",
      });
      setShowCollectionForm(true);
    },
    []
  );

  const closeCollectionForm = useCallback(() => {
    setShowCollectionForm(false);
    setSelectedAlbum(null);
  }, []);

  const saveToCollection = useCallback(
    (e) => {
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

      setCollection((prev) => {
        const filtered = prev.filter((i) => i.id !== entry.id);
        return [entry, ...filtered];
      });
      closeCollectionForm();
    },
    [closeCollectionForm, formValues, selectedAlbum]
  );

  const updateFormField = useCallback((field, value) => {
    setFormValues((f) => ({ ...f, [field]: value }));
  }, []);

  // Collection viewer functions
  const openCollectionView = useCallback(() => {
    setShowCollectionView(true);
  }, []);

  const closeCollectionView = useCallback(() => {
    setShowCollectionView(false);
  }, []);

  const removeFromCollection = useCallback((id) => {
    if (!window.confirm("Remove this album from your collection?")) return;
    setCollection((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const editCollectionEntry = useCallback(
    (entry) => {
      setSelectedAlbum({
        id: entry.id,
        name: entry.name,
        artists: (entry.artists || []).map((n) => ({ name: n })),
        images: [{ url: entry.image }],
        external_urls: { spotify: entry.spotifyUrl },
      });
      setFormValues({
        owned: !!entry.owned,
        format: entry.format || "Vinyl",
        condition: entry.condition || "Good",
        purchaseDate: entry.purchaseDate || "",
        notes: entry.notes || "",
      });
      setShowCollectionForm(true);
      setShowCollectionView(false);
    },
    [setShowCollectionForm, setShowCollectionView, setSelectedAlbum, setFormValues]
  );

  // Function to close search results
  const closeSearchResults = () => {
    setShowSearchResults(false);
    setAlbums([]); // Clear the albums
    setSearchInput(""); // Clear the search input
  };

  // Styles
  const overlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    zIndex: 1200,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
  };

  const collectionOverlayStyle = {
    ... overlayStyle,
    alignItems: "center",
    justifyContent: "center",
  };

  const formStyle = {
    marginTop: "6vh",
    width: "100%",
    maxWidth: 720,
    background: "gray",
    borderRadius: 8,
    padding: 20,
    boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
  };

  const collectionViewerStyle = {
    marginTop: "6vh",
    width: "100%",
    maxWidth: 980,
    background: "white",
    borderRadius: 8,
    padding: 20,
    boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
    position: "relative",
  };

  return (
    <>
      {/* Full-page dropdown / overlay form */}
      {showCollectionForm && (
        <div style={overlayStyle} onClick={closeCollectionForm}>
          <form style={formStyle} onClick={(e) => e.stopPropagation()} onSubmit={saveToCollection}>
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

      {/* Collection viewer overlay */}
      {showCollectionView && (
        <div style={collectionOverlayStyle} onClick={closeCollectionView}>
          <div style={collectionViewerStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
              <h3 style={{ margin: 0 }}>My Collection ({collection.length})</h3>
              <div style={{ display: "flex", gap: 8 }} />
            </div>

            <hr />

            {/* Collection grid: 4 columns, album info hidden behind art (same hover overlay used in search results) */}
            <div className="collection-scroll">
               {collection.length === 0 && (
                 <div style={{ padding: 12, color: "#666" }}>Your collection is empty.</div>
               )}
               {collection.length > 0 && (
                 <div className="collection-grid" style={{ padding: 8 }}>
                   {collection.map((entry) => (
                     <Card key={entry.id} className="album-card">
                       <div className="album-art-wrapper" title={entry.name}>
                         <img src={entry.image || ""} alt={entry.name} className="album-art" />
                         <div className="album-info-overlay">
                           <div className="overlay-content">
                             <div className="overlay-title">{entry.name}</div>
                             <div className="overlay-artists">{(entry.artists || []).join(", ")}</div>
                             <div className="overlay-release">Format: {entry.format} • {entry.condition}</div>
                             {entry.purchaseDate && <div className="overlay-release">Purchased: {entry.purchaseDate}</div>}
                             {entry.notes && <div style={{ marginTop: 6, fontSize: 12 }}>{entry.notes}</div>}
                             <div className="overlay-actions" style={{ marginTop: 8 }}>
                               <Button size="sm" onClick={() => editCollectionEntry(entry)}>Edit</Button>
                               <Button size="sm" variant="danger" onClick={() => removeFromCollection(entry.id)}>Remove</Button>
                               <Button size="sm" variant="outline-secondary" href={entry.spotifyUrl} target="_blank" rel="noreferrer">Open</Button>
                             </div>
                           </div>
                         </div>
                       </div>
                     </Card>
                   ))}
                 </div>
               )}
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
              <Button variant="light" onClick={closeCollectionView}>Close</Button>
            </div>
          </div>
        </div>
      )}

      <Container style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100, padding: '12px 16px',}}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', maxWidth: 1280, margin: '0 auto' }}>
          <InputGroup style={{ flex: 1, maxWidth: 640 }}>
            <FormControl
              placeholder={accessToken ? "Search For An Artist Or Album" : "Waiting for Spotify token..."}
              type="input"
              aria-label="Search for an Artist"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
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
                width: "100%",
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

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ color: "#333", fontSize: 14 }}>
              My collection: {collection.length} album{collection.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        {status && (
          <div style={{ color: "#666", marginTop: "8px", fontSize: "14px", textAlign: 'center' }}>{status}</div>
        )}
      </Container>

      <div style={{ paddingTop: 96 }}></div> {/* Spacer for fixed header */}

      {/* Conditionally render search results */}
      {showSearchResults && (
        <Container>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Search Results</h2>
            <Button onClick={closeSearchResults}>Close Results</Button>
          </div>
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
                  className="album-card"
                >
                  <div className="album-art-wrapper">
                    <img
                      src={album.images?.[0]?.url || ""}
                      alt={album.name}
                      className="album-art"
                    />
                    <div className="album-info-overlay">
                      <div className="overlay-content">
                        <div className="overlay-title">{album.name}</div>
                        <div className="overlay-artists">{(album.artists || []).map((a) => a.name).join(", ")}</div>
                        <div className="overlay-release">Release: {album.release_date}</div>
                        <div className="overlay-actions">
                          <Button
                            size="sm"
                            variant={inCollection ? "success" : "dark"}
                            onClick={() => openAddToCollection(album)}
                          >
                            {inCollection ? "In collection" : "Add"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            href={album.external_urls?.spotify}
                          >
                            Open
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </Row>
        </Container>
      )}

      <Container>
        <Button size="sm" onClick={openCollectionView} style={{position: 'fixed', bottom: 20,}}>
          View collection
        </Button>
      </Container>
    </>
  );
}

export default App;
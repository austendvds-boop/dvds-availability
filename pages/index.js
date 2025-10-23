import Head from "next/head";

const exampleQuery = "/api/availability?title=The%20Matrix";

export default function Home() {
  return (
    <>
      <Head>
        <title>DVD Availability API</title>
        <meta
          name="description"
          content="Simple API that returns the availability of popular DVD titles."
        />
      </Head>
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111827",
          color: "#F9FAFB",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: "2rem",
        }}
      >
        <section
          style={{
            maxWidth: "720px",
            width: "100%",
            background: "#1F2937",
            borderRadius: "1rem",
            padding: "2.5rem",
            boxShadow: "0 20px 45px rgba(15, 23, 42, 0.35)",
          }}
        >
          <h1 style={{ fontSize: "2.5rem", marginBottom: "1rem", fontWeight: 700 }}>
            DVD Availability API
          </h1>
          <p style={{ fontSize: "1.1rem", lineHeight: 1.7, marginBottom: "1.5rem" }}>
            Use the <code style={{ background: "#111827", padding: "0.15rem 0.35rem", borderRadius: "0.3rem" }}>GET {exampleQuery}</code>
            {" "}
            endpoint to retrieve availability information for popular DVD titles. Provide a
            <code style={{ background: "#111827", padding: "0.15rem 0.35rem", borderRadius: "0.3rem" }}>title</code>
            {" "}
            query parameter to search for a specific movie. When no title is supplied the API
            responds with the entire catalog.
          </p>
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "0.75rem", fontWeight: 600 }}>
              Example request
            </h2>
            <pre
              style={{
                background: "#111827",
                padding: "1rem",
                borderRadius: "0.75rem",
                overflowX: "auto",
                fontSize: "0.95rem",
              }}
            >
              {`fetch('${exampleQuery}')\n  .then((res) => res.json())\n  .then(console.log);`}
            </pre>
          </div>
          <div>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "0.75rem", fontWeight: 600 }}>
              Response shape
            </h2>
            <pre
              style={{
                background: "#111827",
                padding: "1rem",
                borderRadius: "0.75rem",
                overflowX: "auto",
                fontSize: "0.95rem",
              }}
            >
              {`{
  ok: true,
  query: "The Matrix",
  count: 1,
  availability: [
    {
      title: "The Matrix",
      releaseYear: 1999,
      formats: ["DVD", "Blu-ray"],
      availability: "in_stock",
      inventoryCount: 12,
      retailers: ["Best Buy", "Target", "Barnes & Noble"],
    }
  ],
  message: "The Matrix is currently in stock."
}`}
            </pre>
          </div>
        </section>
      </main>
    </>
  );
}

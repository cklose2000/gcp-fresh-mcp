import express from "express";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log every request and response (optional - remove for production)
app.use((req, res, next) => {
  console.log(`\n>>> ${req.method} ${req.path}`);
  console.log("Headers:", req.headers);
  if (req.body) console.log("Body:", JSON.stringify(req.body, null, 2));
  
  // Intercept response
  const originalJson = res.json;
  res.json = function(data) {
    console.log("<<< Response:", JSON.stringify(data, null, 2));
    originalJson.call(this, data);
  };
  
  next();
});

// OAuth endpoints
app.get("/.well-known/oauth-authorization-server", (req, res) => {
  const protocol = req.get('x-forwarded-proto') || 'https';
  const base = `${protocol}://${req.get("host")}`;
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"]
  });
});

app.post("/register", (req, res) => {
  res.status(201).json({
    client_id: "mcp-client",
    client_secret: "not-used",
    redirect_uris: req.body.redirect_uris || ["http://localhost"]
  });
});

app.get("/authorize", (req, res) => {
  const { redirect_uri, state } = req.query;
  if (redirect_uri) {
    const url = new URL(redirect_uri);
    url.searchParams.set("code", "dummy-code");
    if (state) url.searchParams.set("state", state);
    res.redirect(url.toString());
  }
});

app.post("/token", (req, res) => {
  res.json({
    access_token: "dummy-token",
    token_type: "Bearer",
    expires_in: 3600
  });
});

// MCP handshake - try different response formats
app.get("/mcp", (req, res) => {
  // Try including more info in handshake
  res.json({ 
    name: "gcp-mcp", 
    transport: "http", 
    version: "1.0",
    description: "GCP MCP Server",
    capabilities: {
      tools: true
    }
  });
});

// MCP protocol handler
app.post("/mcp", (req, res) => {
  const { method, params, id } = req.body;
  console.log(`\nMCP Method: ${method}`);
  console.log("Request ID:", id);
  
  // Build JSON-RPC response
  const response = {
    jsonrpc: "2.0",
    id: id
  };
  
  try {
    if (method === "initialize") {
      response.result = {
        protocolVersion: params?.protocolVersion || "2025-03-26",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
        serverInfo: {
          name: "gcp-mcp",
          version: "1.0.0"
        }
      };
    } else if (method === "tools/list") {
      response.result = {
        tools: [{
          name: "echo",
          description: "Echo a message",
          inputSchema: {
            type: "object",
            properties: {
              message: { 
                type: "string",
                description: "Message to echo"
              }
            },
            required: ["message"]
          }
        }]
      };
    } else if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments;
      
      if (toolName === "echo") {
        response.result = {
          content: [{
            type: "text",
            text: `Echo: ${args?.message || "no message"}`
          }]
        };
      } else {
        response.error = {
          code: -32602,
          message: `Unknown tool: ${toolName}`
        };
      }
    } else {
      response.error = {
        code: -32601,
        message: `Method not found: ${method}`
      };
    }
    
    res.json(response);
  } catch (error) {
    console.error("Error processing request:", error);
    response.error = {
      code: -32603,
      message: "Internal error",
      data: error.message
    };
    res.json(response);
  }
});

// Catch all
app.all("*", (req, res) => {
  console.log(`!!! Unhandled: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Not found" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ MCP server on port ${PORT}`);
  console.log("Full debug logging enabled");
});
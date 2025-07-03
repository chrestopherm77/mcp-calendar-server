const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Google Calendar Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Detectar se está rodando localmente ou no Render
const isProduction = process.env.NODE_ENV === 'production';
const BASE_URL = isProduction ? process.env.RENDER_EXTERNAL_URL : `http://localhost:${PORT}`;
const REDIRECT_URI = `${BASE_URL}/auth/callback`;

console.log('Base URL:', BASE_URL);
console.log('Redirect URI:', REDIRECT_URI);

// OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

// Scopes needed for Google Calendar
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

// Store tokens (in production, use a database)
let userTokens = {};

// MCP Server Info
const SERVER_INFO = {
  name: "google-calendar-server",
  version: "1.0.0",
  description: "Google Calendar management server with MCP support",
  protocolVersion: "2024-11-05"
};

// Available tools
const TOOLS = [
  {
    name: "create_event",
    description: "Create a new Google Calendar event",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Event title"
        },
        description: {
          type: "string",
          description: "Event description"
        },
        start_time: {
          type: "string",
          format: "date-time",
          description: "Event start time (ISO 8601 format)"
        },
        end_time: {
          type: "string",
          format: "date-time",
          description: "Event end time (ISO 8601 format)"
        },
        location: {
          type: "string",
          description: "Event location"
        },
        attendees: {
          type: "array",
          items: {
            type: "string"
          },
          description: "List of attendee emails"
        },
        calendar_id: {
          type: "string",
          description: "Calendar ID (default: 'primary')",
          default: "primary"
        }
      },
      required: ["title", "start_time", "end_time"]
    }
  },
  {
    name: "list_events",
    description: "List Google Calendar events with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        calendar_id: {
          type: "string",
          description: "Calendar ID (default: 'primary')",
          default: "primary"
        },
        time_min: {
          type: "string",
          format: "date-time",
          description: "Lower bound (inclusive) for events (ISO 8601)"
        },
        time_max: {
          type: "string",
          format: "date-time",
          description: "Upper bound (exclusive) for events (ISO 8601)"
        },
        max_results: {
          type: "integer",
          description: "Maximum number of events to return",
          default: 10,
          maximum: 2500
        },
        single_events: {
          type: "boolean",
          description: "Expand recurring events into instances",
          default: true
        }
      }
    }
  },
  {
    name: "get_event",
    description: "Get details of a specific Google Calendar event",
    inputSchema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "Event ID"
        },
        calendar_id: {
          type: "string",
          description: "Calendar ID (default: 'primary')",
          default: "primary"
        }
      },
      required: ["event_id"]
    }
  },
  {
    name: "update_event",
    description: "Update an existing Google Calendar event",
    inputSchema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "Event ID"
        },
        calendar_id: {
          type: "string",
          description: "Calendar ID (default: 'primary')",
          default: "primary"
        },
        title: {
          type: "string",
          description: "Event title"
        },
        description: {
          type: "string",
          description: "Event description"
        },
        start_time: {
          type: "string",
          format: "date-time",
          description: "Event start time (ISO 8601 format)"
        },
        end_time: {
          type: "string",
          format: "date-time",
          description: "Event end time (ISO 8601 format)"
        },
        location: {
          type: "string",
          description: "Event location"
        },
        attendees: {
          type: "array",
          items: {
            type: "string"
          },
          description: "List of attendee emails"
        }
      },
      required: ["event_id"]
    }
  },
  {
    name: "delete_event",
    description: "Delete a Google Calendar event",
    inputSchema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "Event ID"
        },
        calendar_id: {
          type: "string",
          description: "Calendar ID (default: 'primary')",
          default: "primary"
        }
      },
      required: ["event_id"]
    }
  },
  {
    name: "list_calendars",
    description: "List all available Google Calendars",
    inputSchema: {
      type: "object",
      properties: {
        max_results: {
          type: "integer",
          description: "Maximum number of calendars to return",
          default: 10,
          maximum: 250
        }
      }
    }
  },
  {
    name: "search_events",
    description: "Search events in Google Calendar",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query"
        },
        calendar_id: {
          type: "string",
          description: "Calendar ID (default: 'primary')",
          default: "primary"
        },
        max_results: {
          type: "integer",
          description: "Maximum number of events to return",
          default: 10,
          maximum: 2500
        }
      },
      required: ["query"]
    }
  }
];

// Helper function to create JSON-RPC response
function createResponse(id, result = null, error = null) {
  const response = {
    jsonrpc: "2.0",
    id: id
  };
  
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  
  return response;
}

// Helper function to create error response
function createError(id, code, message, data = null) {
  return createResponse(id, null, {
    code: code,
    message: message,
    data: data
  });
}

// Helper function to check if user is authenticated
function isAuthenticated() {
  return userTokens.access_token && userTokens.refresh_token;
}

// Helper function to get authenticated calendar client
function getCalendarClient() {
  if (!isAuthenticated()) {
    throw new Error('User not authenticated. Please authenticate first.');
  }
  
  oauth2Client.setCredentials(userTokens);
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Authentication routes
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    userTokens = tokens;
    oauth2Client.setCredentials(tokens);
    
    res.send(`
      <html>
        <head>
          <title>Authentication Success</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: green; font-size: 24px; margin-bottom: 20px; }
            .info { color: #666; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="success">✅ Authentication Successful!</div>
          <div class="info">
            <p>Your Google Calendar is now connected!</p>
            <p>You can now use the MCP endpoint:</p>
            <p><strong>${BASE_URL}/mcp</strong></p>
            <p>You can close this window.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: red; font-size: 24px; margin-bottom: 20px; }
            .info { color: #666; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="error">❌ Authentication Failed</div>
          <div class="info">
            <p>Error: ${error.message}</p>
            <p>Please try again.</p>
          </div>
        </body>
      </html>
    `);
  }
});

// MCP Protocol endpoints
app.post('/mcp', async (req, res) => {
  try {
    const { jsonrpc, method, params, id } = req.body;
    
    if (jsonrpc !== "2.0") {
      return res.json(createError(id, -32600, "Invalid Request"));
    }
    
    switch (method) {
      case "initialize":
        res.json(createResponse(id, {
          protocolVersion: SERVER_INFO.protocolVersion,
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          serverInfo: SERVER_INFO
        }));
        break;
        
      case "notifications/initialized":
        res.json(createResponse(id, {}));
        break;
        
      case "tools/list":
        res.json(createResponse(id, {
          tools: TOOLS
        }));
        break;
        
      case "tools/call":
        if (!isAuthenticated()) {
          return res.json(createError(id, -32001, "Authentication required", {
            auth_url: `${BASE_URL}/auth`
          }));
        }
        
        const result = await handleToolCall(params);
        res.json(createResponse(id, result));
        break;
        
      default:
        res.json(createError(id, -32601, "Method not found"));
    }
  } catch (error) {
    console.error('MCP Error:', error);
    res.json(createError(req.body?.id || null, -32603, "Internal error", error.message));
  }
});

// Handle tool calls
async function handleToolCall(params) {
  const { name, arguments: args } = params;
  
  switch (name) {
    case "create_event":
      return await createEvent(args);
    case "list_events":
      return await listEvents(args);
    case "get_event":
      return await getEvent(args);
    case "update_event":
      return await updateEvent(args);
    case "delete_event":
      return await deleteEvent(args);
    case "list_calendars":
      return await listCalendars(args);
    case "search_events":
      return await searchEvents(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Tool implementations
async function createEvent(args) {
  const calendar = getCalendarClient();
  const calendarId = args.calendar_id || 'primary';
  
  const event = {
    summary: args.title,
    description: args.description || '',
    location: args.location || '',
    start: {
      dateTime: args.start_time,
      timeZone: 'UTC'
    },
    end: {
      dateTime: args.end_time,
      timeZone: 'UTC'
    }
  };
  
  if (args.attendees && args.attendees.length > 0) {
    event.attendees = args.attendees.map(email => ({ email }));
  }
  
  try {
    const response = await calendar.events.insert({
      calendarId,
      resource: event,
      sendNotifications: true
    });
    
    return {
      content: [{
        type: "text",
        text: `Event created successfully: ${response.data.summary}`
      }],
      event: response.data
    };
  } catch (error) {
    throw new Error(`Failed to create event: ${error.message}`);
  }
}

async function listEvents(args) {
  const calendar = getCalendarClient();
  const calendarId = args.calendar_id || 'primary';
  
  const params = {
    calendarId,
    maxResults: args.max_results || 10,
    singleEvents: args.single_events !== false,
    orderBy: 'startTime'
  };
  
  if (args.time_min) params.timeMin = args.time_min;
  if (args.time_max) params.timeMax = args.time_max;
  
  try {
    const response = await calendar.events.list(params);
    const events = response.data.items || [];
    
    return {
      content: [{
        type: "text",
        text: `Found ${events.length} events`
      }],
      events: events
    };
  } catch (error) {
    throw new Error(`Failed to list events: ${error.message}`);
  }
}

async function getEvent(args) {
  const calendar = getCalendarClient();
  const calendarId = args.calendar_id || 'primary';
  
  try {
    const response = await calendar.events.get({
      calendarId,
      eventId: args.event_id
    });
    
    return {
      content: [{
        type: "text",
        text: `Event details: ${response.data.summary}`
      }],
      event: response.data
    };
  } catch (error) {
    throw new Error(`Failed to get event: ${error.message}`);
  }
}

async function updateEvent(args) {
  const calendar = getCalendarClient();
  const calendarId = args.calendar_id || 'primary';
  
  try {
    // First get the current event
    const currentEvent = await calendar.events.get({
      calendarId,
      eventId: args.event_id
    });
    
    const event = currentEvent.data;
    
    // Update only provided fields
    if (args.title !== undefined) event.summary = args.title;
    if (args.description !== undefined) event.description = args.description;
    if (args.location !== undefined) event.location = args.location;
    if (args.start_time !== undefined) {
      event.start = { dateTime: args.start_time, timeZone: 'UTC' };
    }
    if (args.end_time !== undefined) {
      event.end = { dateTime: args.end_time, timeZone: 'UTC' };
    }
    if (args.attendees !== undefined) {
      event.attendees = args.attendees.map(email => ({ email }));
    }
    
    const response = await calendar.events.update({
      calendarId,
      eventId: args.event_id,
      resource: event,
      sendNotifications: true
    });
    
    return {
      content: [{
        type: "text",
        text: `Event updated successfully: ${response.data.summary}`
      }],
      event: response.data
    };
  } catch (error) {
    throw new Error(`Failed to update event: ${error.message}`);
  }
}

async function deleteEvent(args) {
  const calendar = getCalendarClient();
  const calendarId = args.calendar_id || 'primary';
  
  try {
    // First get event details for confirmation
    const event = await calendar.events.get({
      calendarId,
      eventId: args.event_id
    });
    
    await calendar.events.delete({
      calendarId,
      eventId: args.event_id,
      sendNotifications: true
    });
    
    return {
      content: [{
        type: "text",
        text: `Event deleted successfully: ${event.data.summary}`
      }],
      deleted_event_id: args.event_id
    };
  } catch (error) {
    throw new Error(`Failed to delete event: ${error.message}`);
  }
}

async function listCalendars(args) {
  const calendar = getCalendarClient();
  
  try {
    const response = await calendar.calendarList.list({
      maxResults: args.max_results || 10
    });
    
    const calendars = response.data.items || [];
    
    return {
      content: [{
        type: "text",
        text: `Found ${calendars.length} calendars`
      }],
      calendars: calendars
    };
  } catch (error) {
    throw new Error(`Failed to list calendars: ${error.message}`);
  }
}

async function searchEvents(args) {
  const calendar = getCalendarClient();
  const calendarId = args.calendar_id || 'primary';
  
  try {
    const response = await calendar.events.list({
      calendarId,
      q: args.query,
      maxResults: args.max_results || 10,
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    const events = response.data.items || [];
    
    return {
      content: [{
        type: "text",
        text: `Found ${events.length} events matching "${args.query}"`
      }],
      events: events
    };
  } catch (error) {
    throw new Error(`Failed to search events: ${error.message}`);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    server: SERVER_INFO,
    authenticated: isAuthenticated(),
    timestamp: new Date().toISOString()
  });
});

// Get server info
app.get('/info', (req, res) => {
  res.json({
    server: SERVER_INFO,
    tools: TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description
    })),
    authenticated: isAuthenticated(),
    auth_url: isAuthenticated() ? null : `${BASE_URL}/auth`
  });
});

// Root endpoint
app.get('/', (req, res) => {
  const authStatus = isAuthenticated();
  
  res.send(`
    <html>
      <head>
        <title>MCP Google Calendar Server</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
          .success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .warning { background-color: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
          .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
          .endpoint { background-color: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h1>MCP Google Calendar Server</h1>
        <p>Version: ${SERVER_INFO.version}</p>
        
        <div class="status ${authStatus ? 'success' : 'warning'}">
          ${authStatus ? 
            '✅ Google Calendar Connected' : 
            '⚠️ Google Calendar Not Connected'
          }
        </div>
        
        ${!authStatus ? 
          `<p><a href="/auth" class="button">Connect Google Calendar</a></p>` : 
          ''
        }
        
        <h2>MCP Endpoint</h2>
        <div class="endpoint">${BASE_URL}/mcp</div>
        
        <h2>Available Tools</h2>
        <ul>
          ${TOOLS.map(tool => `<li><strong>${tool.name}</strong>: ${tool.description}</li>`).join('')}
        </ul>
        
        <h2>Other Endpoints</h2>
        <ul>
          <li><a href="/health">Health Check</a></li>
          <li><a href="/info">Server Info</a></li>
          <li><a href="/auth">Google Authentication</a></li>
        </ul>
      </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`MCP Google Calendar Server running on port ${PORT}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Health check: ${BASE_URL}/health`);
  console.log(`Server info: ${BASE_URL}/info`);
  console.log(`MCP endpoint: ${BASE_URL}/mcp`);
  console.log(`Authentication: ${BASE_URL}/auth`);
});

module.exports = app;

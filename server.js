const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for events (in production, use a database)
let events = [];

// MCP Server Info
const SERVER_INFO = {
  name: "calendar-server",
  version: "1.0.0",
  description: "Calendar management server with MCP support",
  protocolVersion: "2024-11-05"
};

// Available tools
const TOOLS = [
  {
    name: "create_event",
    description: "Create a new calendar event",
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
        }
      },
      required: ["title", "start_time", "end_time"]
    }
  },
  {
    name: "list_events",
    description: "List calendar events with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          format: "date",
          description: "Filter events from this date (YYYY-MM-DD)"
        },
        end_date: {
          type: "string",
          format: "date",
          description: "Filter events until this date (YYYY-MM-DD)"
        },
        limit: {
          type: "integer",
          description: "Maximum number of events to return",
          default: 10
        }
      }
    }
  },
  {
    name: "get_event",
    description: "Get details of a specific event",
    inputSchema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "Event ID"
        }
      },
      required: ["event_id"]
    }
  },
  {
    name: "update_event",
    description: "Update an existing calendar event",
    inputSchema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "Event ID"
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
    description: "Delete a calendar event",
    inputSchema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "Event ID"
        }
      },
      required: ["event_id"]
    }
  },
  {
    name: "search_events",
    description: "Search events by title or description",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query"
        },
        limit: {
          type: "integer",
          description: "Maximum number of events to return",
          default: 10
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
    case "search_events":
      return await searchEvents(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Tool implementations
async function createEvent(args) {
  const event = {
    id: uuidv4(),
    title: args.title,
    description: args.description || "",
    start_time: args.start_time,
    end_time: args.end_time,
    location: args.location || "",
    attendees: args.attendees || [],
    created_at: new Date().toISOString()
  };
  
  events.push(event);
  
  return {
    content: [{
      type: "text",
      text: `Event created successfully with ID: ${event.id}`
    }],
    event: event
  };
}

async function listEvents(args) {
  let filteredEvents = events;
  
  if (args.start_date) {
    const startDate = new Date(args.start_date);
    filteredEvents = filteredEvents.filter(event => 
      new Date(event.start_time) >= startDate
    );
  }
  
  if (args.end_date) {
    const endDate = new Date(args.end_date);
    filteredEvents = filteredEvents.filter(event => 
      new Date(event.start_time) <= endDate
    );
  }
  
  const limit = args.limit || 10;
  const limitedEvents = filteredEvents.slice(0, limit);
  
  return {
    content: [{
      type: "text",
      text: `Found ${limitedEvents.length} events`
    }],
    events: limitedEvents
  };
}

async function getEvent(args) {
  const event = events.find(e => e.id === args.event_id);
  
  if (!event) {
    throw new Error(`Event not found: ${args.event_id}`);
  }
  
  return {
    content: [{
      type: "text",
      text: `Event details for: ${event.title}`
    }],
    event: event
  };
}

async function updateEvent(args) {
  const eventIndex = events.findIndex(e => e.id === args.event_id);
  
  if (eventIndex === -1) {
    throw new Error(`Event not found: ${args.event_id}`);
  }
  
  const event = events[eventIndex];
  
  // Update only provided fields
  if (args.title !== undefined) event.title = args.title;
  if (args.description !== undefined) event.description = args.description;
  if (args.start_time !== undefined) event.start_time = args.start_time;
  if (args.end_time !== undefined) event.end_time = args.end_time;
  if (args.location !== undefined) event.location = args.location;
  if (args.attendees !== undefined) event.attendees = args.attendees;
  
  event.updated_at = new Date().toISOString();
  
  return {
    content: [{
      type: "text",
      text: `Event updated successfully: ${event.title}`
    }],
    event: event
  };
}

async function deleteEvent(args) {
  const eventIndex = events.findIndex(e => e.id === args.event_id);
  
  if (eventIndex === -1) {
    throw new Error(`Event not found: ${args.event_id}`);
  }
  
  const deletedEvent = events.splice(eventIndex, 1)[0];
  
  return {
    content: [{
      type: "text",
      text: `Event deleted successfully: ${deletedEvent.title}`
    }],
    deleted_event_id: args.event_id
  };
}

async function searchEvents(args) {
  const query = args.query.toLowerCase();
  const limit = args.limit || 10;
  
  const matchedEvents = events.filter(event => 
    event.title.toLowerCase().includes(query) ||
    event.description.toLowerCase().includes(query)
  ).slice(0, limit);
  
  return {
    content: [{
      type: "text",
      text: `Found ${matchedEvents.length} events matching "${args.query}"`
    }],
    events: matchedEvents
  };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    server: SERVER_INFO,
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
    events_count: events.length
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: "MCP Calendar Server",
    server: SERVER_INFO,
    endpoints: {
      mcp: "/mcp",
      health: "/health",
      info: "/info"
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`MCP Calendar Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Server info: http://localhost:${PORT}/info`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});

module.exports = app;

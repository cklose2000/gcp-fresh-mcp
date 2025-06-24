// Example of how to add custom tools to your MCP server
// Copy the relevant parts into your main.js file

// In the tools/list handler, add your new tools:
const exampleTools = [
  {
    name: "get_time",
    description: "Get the current time in a specified timezone",
    inputSchema: {
      type: "object",
      properties: {
        timezone: { 
          type: "string",
          description: "Timezone (e.g., 'America/New_York', 'Europe/London')",
          default: "UTC"
        }
      }
    }
  },
  {
    name: "calculate",
    description: "Perform basic arithmetic calculations",
    inputSchema: {
      type: "object",
      properties: {
        expression: { 
          type: "string",
          description: "Mathematical expression (e.g., '2 + 2', '10 * 5')"
        }
      },
      required: ["expression"]
    }
  },
  {
    name: "random_number",
    description: "Generate a random number within a range",
    inputSchema: {
      type: "object",
      properties: {
        min: { 
          type: "number",
          description: "Minimum value (inclusive)",
          default: 0
        },
        max: { 
          type: "number",
          description: "Maximum value (inclusive)",
          default: 100
        }
      }
    }
  }
];

// In the tools/call handler, add the implementations:
if (toolName === "get_time") {
  const timezone = args?.timezone || "UTC";
  try {
    const date = new Date();
    const options = { 
      timeZone: timezone,
      dateStyle: 'full',
      timeStyle: 'long'
    };
    const formattedTime = date.toLocaleString('en-US', options);
    
    response.result = {
      content: [{
        type: "text",
        text: `Current time in ${timezone}: ${formattedTime}`
      }]
    };
  } catch (error) {
    response.error = {
      code: -32602,
      message: `Invalid timezone: ${timezone}`
    };
  }
} else if (toolName === "calculate") {
  const expression = args?.expression;
  if (!expression) {
    response.error = {
      code: -32602,
      message: "Expression is required"
    };
  } else {
    try {
      // Simple safe math evaluation (be careful with eval in production!)
      // Consider using a proper math parser library instead
      const result = Function('"use strict"; return (' + expression + ')')();
      
      response.result = {
        content: [{
          type: "text",
          text: `${expression} = ${result}`
        }]
      };
    } catch (error) {
      response.error = {
        code: -32602,
        message: `Invalid expression: ${expression}`
      };
    }
  }
} else if (toolName === "random_number") {
  const min = args?.min ?? 0;
  const max = args?.max ?? 100;
  
  if (min > max) {
    response.error = {
      code: -32602,
      message: "Min value must be less than or equal to max value"
    };
  } else {
    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
    
    response.result = {
      content: [{
        type: "text",
        text: `Random number between ${min} and ${max}: ${randomNum}`
      }]
    };
  }
}

// Example of a tool that returns structured data
const structuredDataExample = {
  name: "get_system_info",
  description: "Get information about the MCP server",
  inputSchema: {
    type: "object",
    properties: {}
  }
};

// Implementation that returns multiple content items
if (toolName === "get_system_info") {
  response.result = {
    content: [
      {
        type: "text",
        text: "System Information:"
      },
      {
        type: "text",
        text: `Node Version: ${process.version}`
      },
      {
        type: "text",
        text: `Platform: ${process.platform}`
      },
      {
        type: "text",
        text: `Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
      }
    ]
  };
}
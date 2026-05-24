import { notificationTools } from "./pi-vscode-bridge-tools-notifications.js";

export function createBridgeTools({ noParamsTool, withParamsTool }) {
  const schemas = createSchemas();
  return [
    ...stateTools(noParamsTool, withParamsTool),
    ...navigationTools(noParamsTool, withParamsTool, schemas),
    ...symbolCoreTools(withParamsTool, schemas),
    ...symbolLookupTools(withParamsTool, schemas),
    ...symbolAdvancedTools(withParamsTool, schemas),
    ...codeActionTools(withParamsTool),
    ...formattingTools(withParamsTool, schemas),
    ...notificationTools(noParamsTool, withParamsTool),
  ];
}

function stateTools(noParamsTool, withParamsTool) {
  return [
    noParamsTool({
      name: "vscode_get_editor_state",
      label: "VS Code Editor State",
      description: "Read active editor, selection, open editors, and workspace folders.",
      rpcMethod: "getEditorState",
    }),
    noParamsTool({
      name: "vscode_get_selection",
      label: "VS Code Current Selection",
      description: "Read active editor selection.",
      rpcMethod: "getCurrentSelection",
    }),
    noParamsTool({
      name: "vscode_get_latest_selection",
      label: "VS Code Latest Selection",
      description: "Read latest cached selection.",
      rpcMethod: "getLatestSelection",
    }),
    withParamsTool({
      name: "vscode_get_diagnostics",
      label: "VS Code Diagnostics",
      description: "Read diagnostics for file or workspace.",
      rpcMethod: "getDiagnostics",
      parameters: {
        type: "object",
        properties: { filePath: { type: "string" } },
        additionalProperties: false,
      },
    }),
  ];
}

function navigationTools(noParamsTool, withParamsTool, schemas) {
  return [
    noParamsTool({
      name: "vscode_get_open_editors",
      label: "VS Code Open Editors",
      description: "List open editors.",
      rpcMethod: "getOpenEditors",
    }),
    noParamsTool({
      name: "vscode_get_workspace_folders",
      label: "VS Code Workspace Folders",
      description: "List workspace folders.",
      rpcMethod: "getWorkspaceFolders",
    }),
    withParamsTool({
      name: "vscode_open_file",
      label: "VS Code Open File",
      executionMode: "sequential",
      description: "Open a file and optionally select a range.",
      rpcMethod: "openFile",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          preview: { type: "boolean" },
          preserveFocus: { type: "boolean" },
          selection: schemas.rangeSchema(),
        },
        required: ["filePath"],
        additionalProperties: false,
      },
    }),
    withParamsTool({
      name: "vscode_save_document",
      label: "VS Code Save Document",
      executionMode: "sequential",
      description: "Save a document through VS Code.",
      rpcMethod: "saveDocument",
      parameters: schemas.filePathParam,
    }),
  ];
}

function symbolCoreTools(withParamsTool, schemas) {
  return [
    withParamsTool({
      name: "vscode_get_document_symbols",
      label: "VS Code Document Symbols",
      description: "Get symbols for a file.",
      rpcMethod: "getDocumentSymbols",
      parameters: schemas.filePathParam,
    }),
    withParamsTool({
      name: "vscode_get_definitions",
      label: "VS Code Definitions",
      description: "Get symbol definitions at position.",
      rpcMethod: "getDefinitions",
      parameters: schemas.positionParams(),
    }),
    withParamsTool({
      name: "vscode_get_type_definitions",
      label: "VS Code Type Definitions",
      description: "Get symbol type definitions at position.",
      rpcMethod: "getTypeDefinitions",
      parameters: schemas.positionParams(),
    }),
    withParamsTool({
      name: "vscode_get_implementations",
      label: "VS Code Implementations",
      description: "Get symbol implementations at position.",
      rpcMethod: "getImplementations",
      parameters: schemas.positionParams(),
    }),
  ];
}

function symbolLookupTools(withParamsTool, schemas) {
  return [
    withParamsTool({
      name: "vscode_get_declarations",
      label: "VS Code Declarations",
      description: "Get symbol declarations at position.",
      rpcMethod: "getDeclarations",
      parameters: schemas.positionParams(),
    }),
    withParamsTool({
      name: "vscode_get_hover",
      label: "VS Code Hover",
      description: "Get hover information at position.",
      rpcMethod: "getHover",
      parameters: schemas.positionParams(),
    }),
    withParamsTool({
      name: "vscode_get_references",
      label: "VS Code References",
      description: "Get symbol references at position.",
      rpcMethod: "getReferences",
      parameters: schemas.positionParams(),
    }),
  ];
}

function symbolAdvancedTools(withParamsTool, schemas) {
  return [
    withParamsTool({
      name: "vscode_get_workspace_symbols",
      label: "VS Code Workspace Symbols",
      description: "Search workspace symbols.",
      rpcMethod: "getWorkspaceSymbols",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
    }),
    withParamsTool({
      name: "vscode_get_code_actions",
      label: "VS Code Code Actions",
      description: "Get available code actions for selection or range.",
      rpcMethod: "getCodeActions",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          selection: schemas.rangeSchema(),
          start: schemas.pointSchema(),
          end: schemas.pointSchema(),
        },
        required: ["filePath"],
        additionalProperties: false,
      },
    }),
  ];
}

function codeActionTools(withParamsTool) {
  return [
    withParamsTool({
      name: "vscode_execute_code_action",
      label: "VS Code Execute Code Action",
      executionMode: "sequential",
      description: "Execute a cached code action.",
      rpcMethod: "executeCodeAction",
      parameters: {
        type: "object",
        properties: { actionId: { type: "string" } },
        required: ["actionId"],
        additionalProperties: false,
      },
    }),
    withParamsTool({
      name: "vscode_apply_workspace_edit",
      label: "VS Code Apply Workspace Edit",
      executionMode: "sequential",
      description: "Apply range-based workspace edits.",
      rpcMethod: "applyWorkspaceEdit",
      parameters: {
        type: "object",
        properties: { edits: { type: "array" } },
        required: ["edits"],
        additionalProperties: false,
      },
    }),
  ];
}

function formattingTools(withParamsTool, schemas) {
  return [
    withParamsTool({
      name: "vscode_format_document",
      label: "VS Code Format Document",
      executionMode: "sequential",
      description: "Format full document.",
      rpcMethod: "formatDocument",
      parameters: schemas.filePathParam,
    }),
    withParamsTool({
      name: "vscode_format_range",
      label: "VS Code Format Range",
      executionMode: "sequential",
      description: "Format selected range.",
      rpcMethod: "formatRange",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          selection: schemas.rangeSchema(),
          start: schemas.pointSchema(),
          end: schemas.pointSchema(),
        },
        required: ["filePath"],
        additionalProperties: false,
      },
    }),
  ];
}

function createSchemas() {
  return {
    filePathParam: {
      type: "object",
      properties: { filePath: { type: "string" } },
      required: ["filePath"],
      additionalProperties: false,
    },
    pointSchema,
    rangeSchema() {
      return rangeSchema(this.pointSchema);
    },
    positionParams() {
      return positionParams(this.pointSchema);
    },
  };
}

function pointSchema() {
  return {
    type: "object",
    properties: { line: { type: "number" }, character: { type: "number" } },
    required: ["line", "character"],
    additionalProperties: false,
  };
}

function rangeSchema(buildPointSchema) {
  return {
    type: "object",
    properties: { start: buildPointSchema(), end: buildPointSchema() },
    required: ["start", "end"],
    additionalProperties: false,
  };
}

function positionParams(buildPointSchema) {
  return {
    type: "object",
    properties: {
      filePath: { type: "string" },
      position: buildPointSchema(),
    },
    required: ["filePath", "position"],
    additionalProperties: false,
  };
}

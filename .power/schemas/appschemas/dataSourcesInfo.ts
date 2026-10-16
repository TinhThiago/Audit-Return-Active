/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 * This file is auto-generated. Do not modify it manually.
 * Changes to this file may be overwritten.
 */

export const dataSourcesInfo = {
  "audits": {
    "tableId": "",
    "version": "",
    "primaryKey": "auditid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "ph_item_masters": {
    "tableId": "",
    "version": "",
    "primaryKey": "ph_item_masterid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "retrieveauditdetails": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "RetrieveAuditDetails": {
        "path": "/api/data/v9.2/audits({id})/Microsoft.Dynamics.CRM.RetrieveAuditDetails",
        "method": "GET",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "type": "string",
            "format": "guid"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "retrievemetadatachanges": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "RetrieveMetadataChanges": {
        "path": "/api/data/v9.2/RetrieveMetadataChanges",
        "method": "GET",
        "parameters": [
          {
            "name": "Query",
            "in": "query",
            "required": false,
            "type": "object"
          },
          {
            "name": "DeletedMetadataFilters",
            "in": "query",
            "required": false,
            "type": "object"
          },
          {
            "name": "ClientVersionStamp",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "AppModuleId",
            "in": "query",
            "required": false,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "RetrieveAllSettings",
            "in": "query",
            "required": false,
            "type": "boolean"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "webcontents": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Connector",
    "apis": {
      "GetFileContent": {
        "path": "/{connectionId}/GetFileContent",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "path",
            "in": "query",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "string",
            "format": "binary"
          },
          "default": {
            "type": "object"
          }
        }
      },
      "InvokeHttp": {
        "path": "/{connectionId}/codeless/InvokeHttp",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "request",
            "in": "body",
            "required": true,
            "type": "object"
          }
        ],
        "responseInfo": {
          "default": {
            "type": "object"
          }
        }
      }
    }
  }
};

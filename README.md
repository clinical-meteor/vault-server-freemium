## Symptomatic - Vault Server (The Free Version!)  

Welcome to the Symptomatic Vault Server.  

This library provides a free FHIR server, and is intended for rapid prototyping of workflows.   If you need advanced features, such as HIPAA compliance, OAuth security, identity lookups, data pipelining, data-mappings, proxy routing, mesh networking, blockchain, etc... please contact inquiries@symptomatic.io for more information about upgrading to the licensed version.  


#### HIPAA Compliance  

This library is for EVALUATION PURPOSES ONLY, and should NOT be used in production.  This library is only HIPAA compliant if it is used entirely behind a VPN firewall.  Otherwise, it does not encrypt data over the wire or at rest, and it does not enforce user authentication or audit logs.  You will need to implement these features yourself.  


#### API  

```bash
# install the vault server module
meteor add symptomatic:vault-server-freemium  

# or run it with a template
meteor run --extra-packages symptomatic:vault-server-freemium --settings path/to/my/config/settings.json
```


#### Settings File  

You will want to modify the Meteor.settings file.

```json
{
  "private": {
    "invitationCode": "Foo",
    "fhir": {
      "disableOauth": true,
      "schemaValidation": {
        "filter": false,
        "validate": false
      },
      "fhirPath": "baseR4",
      "rest": {
        "AuditEvent": {
          "interactions": ["read", "create"],
          "search": true
        },
        "Condition": {
          "interactions": ["read", "create", "update"],
          "search": true
        },
        "Device": {
          "interactions": ["read", "create", "update", "delete"],
          "search": true
        },
        "Encounter": {
          "interactions": ["read", "create", "update"],
          "search": true
        },
        "Medication": {
          "interactions": ["read", "create", "update"],
          "search": true
        },
        "Observation": {
          "interactions": ["read", "create", "update"],
          "search": true
        },
        "Organization": {
          "interactions": ["read", "create", "update"],
          "search": true
        },
        "Patient": {
          "interactions": ["read", "create", "update"],
          "search": true
        },
        "Provider": {
          "interactions": ["read", "create", "update"],
          "search": true
        }
      }
    }
  }
}
```


#### License  
All Rights Reserved.  The contents of this repository are available via the Clarified Artistic License.   
https://spdx.org/licenses/ClArtistic.html  





# Baw Database Tables and Fields

Generated on 2026-04-29.

Legend:
- `(deleted)` = legacy field still present in schema but marked deleted.

## Activity Log
- Action - deleted (deleted)
- Keys
- Landlord
- Maintenance
- Property
- Staff
- Suppliers
- Target Item - deleted (deleted)
- Tenant
- Timestamp - deleted (deleted)
- Type
- User

## Bank Account
- access_token
- item_id
- last_synced_date
- user

## Certification
- Linked Unit
- Document
- Expiry Date
- IsExpired
- Notes
- Property
- Type

## Certification Type
- Default Expiry Period (months)
- Name

## Chat Message
- Attachments
- Message
- Sender
- Thread
- Timestamp

## Chat Thread
- Is Group Chat?
- Last Updated
- Messages
- Participants
- Title

## Comment
- Author
- Created Date
- Maintenance
- Message
- Photos

## Communication Log
- Author
- Channel
- Message
- Recipient Property
- Recipient User
- Timestamp

## Dashboard Configuration
- Default View
- Enabled Widgets
- User

## Document
- 🆕 Certification
- 🆕 Landlord
- 🆕 Link
- 🆕 Maintenance Job
- 🆕 Property
- 🆕 Staff
- 🆕 Supplier
- 🆕 Tenant
- Linked To (Option Set)
- Expiry Date
- File
- Lease
- name
- Permissions
- Property
- Tag
- Tenant (Text)
- Tenant (User)
- Uploaded By

## File Tag
- Name

## Key
- Assigned To
- Currently With (HOLDER)
- Date Given
- Date Returned
- Key Code
- Notes - deleted (deleted)
- Notes
- Property
- Reference ID
- Spares (count)
- Spares (boolean)
- Status
- Type Held by

## Key_logs
- action_in_when
- action_out_when
- held_by_type_snapshot
- holder
- is_open (yes/no)
- is_spare_snapshot
- issued_by
- key
- notes
- property
- received_by (User)
- status_after_return (option set)

## Landlord (mirror)
- No fields currently defined

## Lease
- Agreement File
- documents
- End Date
- move_in_date
- payment_frequency
- property
- renewal date
- renewal date - deleted (deleted)
- Rent Amount
- Start Date
- Status
- Tenancy Code
- Tenant
- Tenant - deleted (deleted)
- Unit

## Login Session
- Device Info
- IP Address
- Login Date
- User

## Maintenance
- Assigned Staff
- Comment Thread
- Completion Date
- Cost
- Description
- documents
- For Property
- For Unit
- Notes
- Notes - deleted (deleted)
- Notes (deleted)
- Photos
- Planned Date
- Related Supplier
- Resolution Time
- Response Time
- Status
- Status - deleted (deleted)
- Submitted By
- Supplier - deleted (deleted)
- Timestamps
- Type
- Urgency

## Notification
- Date Sent
- Delivery Channel
- Lease
- Maintenance
- To
- Trigger Source
- Type
- Was Sent?

## Plaid Account
- Account ID
- Account Mask
- Account Name
- Account Subtype
- Account Type
- Institution

## Plaid Institution
- Access token
- Accounts
- Institution ID
- Institution Name
- Item ID

## Plaid Link Token
- error_message
- expires at
- token

## Plaid Webhook
- code
- error
- item id
- new_transaction_count
- type

## Property
- Address
- Area
- Assigned Manager
- bedrooms
- Certifications - deleted (deleted)
- Certifications
- Class
- Country
- Country
- Date Acquired
- documents
- Documents
- Financial Records
- Internal Code
- Keys
- Landlord
- Landlord  - deleted (deleted)
- Landlord Contact - deleted (deleted)
- Landlord Name - deleted (deleted)
- Leasehold Register Number
- Maintenance Jobs
- Name
- Notes
- Number of Units
- Parent Building
- Post Code
- properties_as_units_only
- Property_Configuration
- Property_Tax
- Property_type
- Rent collected?
- Status
- Target Rent
- Target_rent_year
- Tenancy Class
- Town
- Units - deleted (deleted)
- utilities

## Property Unit
- Lease Agreements
- Maintenance Requests
- Parent Property
- Payment History
- Status
- Tenancy End
- Tenancy Start
- Tenant
- Unit Number

## Reminder
- Alert Date
- Alert Time
- Assignees
- Assignees - deleted - deleted (deleted)
- Comments - deleted - deleted (deleted)
- Content
- DD - deleted - deleted (deleted)
- Deal - deleted (deleted)
- documents - deleted - deleted (deleted)
- list of user to send
- Reminder_schedule - deleted
- reminder_status
- sent
- Tasks - deleted - deleted (deleted)

## RentSchedule
- amount_collected
- amount_difference
- amount_due
- due_date
- Invoice Status
- lease
- notes
- property
- Reconciled?
- tenant

## Spares
- Holder
- Key
- Reference

## Supplier
- Outstanding
- Primary Contact email
- Primary Contact name
- Business Name
- documents
- Notes
- Preferred?
- Status
- Type

## Support Comment
- Author
- Created Date
- Files
- Message
- Ticket

## Support Ticket
- Assigned To
- Attachments
- Category
- Created By
- Description
- Priority
- Status
- Subject

## System Setting
- Active
- Comments
- File Upload
- Setting Name
- Setting Type
- Timestamps
- Value

## Tenant (mirror)
- Acquired Date
- Agreed Rent
- Assigned Properties
- Assigned Property
- Assigned Unit
- Assigned Units (list)
- Bio
- documents
- Email
- First name
- Forwarding Address
- Full name
- Guarantor_email
- Guarantor_name
- Guarantor_phone
- Last name
- Lease Duration - deleted (deleted)
- Lease End
- Lease Start
- Move In Date
- next of kin address
- Next of Kin_address
- Next of Kin_email
- Next of Kin_name
- Next of Kin_phone
- Next of Kin_relationship
- Notes
- Payment Frequency
- Phone
- Position
- Prefered_contact
- Profile picture
- Related user (data type)
- Status
- Tenant_Code
- Tenant Status - deleted (deleted)
- Tenant_type

## Landlord (mirror)
- Assigned Properties
- Assigned Property
- Assigned Unit
- Assigned Units (list)
- Bio
- Company Registration Date
- Company registration date - deleted (deleted)
- Documents
- Email
- First name
- Full name
- Landlord_type
- Last name
- LL_Director_email
- LL_Director_name
- LL_Director_phone
- LL_trustees_email
- LL_trustees_name
- LL_trustees_phone
- Main Contact Email
- Main Contact Name
- Main Contact Phone
- Phone
- prefered_contact
- Profile picture
- Related user (data type)
- Property Status
- VAT Number

## Transaction
- (main) amount
- (main) authorized_date
- (main) category id
- (main) category
- (main) category - deleted (deleted)
- (main) currency
- (main) date
- (main) id
- (main) merchant name
- (main) name
- (main) payment_channel
- Account
- Amount
- Category
- Date
- Linked Invoice
- Linked Landlord
- Linked Lease
- Linked Property
- Linked Tenant
- Linked Unit
- Manual Entry
- Needs Review
- Notes
- Plaid - Bank Name
- Plaid - Is Synced with Plaid
- Plaid - Pending
- Plaid Account ID
- Plaid Category (list)
- Plaid Category (simple)
- Plaid Name
- Plaid Sync Timestamp
- Plaid Transaction ID
- Receipt/Proof
- Reconciled With
- Type

## User
- Assigned Properties
- Assigned Property
- Assigned Unit
- Bio
- First name
- Full name
- Last name
- Phone
- Profile picture
- Related landlord (data type)
- Related tenant (data type)
- Role
- Tenant Status
- TwoFAEnabled

## Utilities
- meter location
- notes
- property
- serial_number
- suppliers
- utility_type

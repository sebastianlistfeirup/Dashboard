# Ungapped API — operation map

Generated: 2026-09-02T21:18:10.276Z
Spec: `Ungapped API` version `v2`
Operations: 244 across 15 tags
Auth: `X-API-KEY` header

## Compliance (1)

- `POST /Compliance/Anonymize` — required: contactId(query)

## Contacts (35)

- `DELETE /Contacts` — required: contacts(body) — Deletes one or more contacts (recoverable).
- `GET /Contacts` — Get all contacts.
- `POST /Contacts` — required: contacts(body) — Creates the contacts.
If email already exists the contact is updated.
- `GET /Contacts/{contactId}` — required: contactId(path) — Get a contact by its id.
- `POST /Contacts/{contactId}/{property}` — required: contactId(path), property(path), value(body) — Updates one property of the contact.
- `POST /Contacts/{contactId}/Bounce` — required: contactId(path), issueId(query)
- `GET /Contacts/{contactId}/Categories` — required: contactId(path) — Get all categories that the contact has not unsubscribed from.
- `POST /Contacts/{contactId}/Categories` — required: contactId(path), categories(body) — Handle categories(subscriptions) for a Contact
- `GET /Contacts/{contactId}/DataGroups` — required: contactId(path) — Gets all activity for one contact
- `DELETE /Contacts/{contactId}/Lists` — required: contactId(path), lists(body) — Removes the contact from one or more lists.
- `POST /Contacts/{contactId}/Lists` — required: contactId(path), lists(body) — Add contact in lists .
- `POST /Contacts/{contactId}/Tags` — required: contactId(path), tags(body)
- `GET /Contacts/{contactId}/Timeline` — required: contactId(path) — Gets all activity for one contact
- `POST /Contacts/{contactId}/Unsubscribe` — required: contactId(path), issueId(query)
- `GET /Contacts/{contactId}/UnsubscribeReason` — required: contactId(path)
- `POST /Contacts/{id}` — required: id(path), contact(body) — Update a contact.
- `GET /Contacts/{id}/Lists` — required: id(path) — Get all lists containing the contact is in.
- `POST /Contacts/{listId}/PreUnsubscribedFromCategory/{categoryIdToUnsubscribe}` — required: listId(path), categoryIdToUnsubscribe(path) — Handle pre unsubscribed for Contacts
- `GET /Contacts/Active` — Get all  Active contacts.
- `GET /Contacts/Autocomplete` — required: property(query), value(query) — Get values for autocomplete
- `GET /Contacts/Autocomplete/DataPoint` — required: value(query) — Get values for autocomplete
- `GET /Contacts/Autocomplete/DataPoint/Key` — required: key(query), type(query) — Get values for autocomplete
- `GET /Contacts/Block` — Get all  Block or non Ative contacts.
- `GET /Contacts/BlockSms` — Get all BlockSms or No ActiveSms contacts.
- `GET /Contacts/Bounce` — Get all Bounced contacts.
- `DELETE /Contacts/BulkByIds` — required: contactIds(body) — Deletes contacts by ContactIds in bulk by sending batches via bus, processing up to 5000 contacts in 500-contact batches (recoverable).
- `GET /Contacts/Count` — Count all contacts.
- `GET /Contacts/Delete` — Get all  Delete (marked with status delete) contacts.
- `GET /Contacts/ExcelExport` — Request Excel export of contacts for the current account
If listId is provided, exports only contacts in that list
Otherwise exports all contacts for the account
- `GET /Contacts/External/{externalId}` — required: externalId(path) — Get a contact by its external id.
- `GET /Contacts/External/{externalId}/Timeline` — required: externalId(path)
- `GET /Contacts/Fields` — Used for integration purposes to present possible fields on a contact which may be updated using UpdateContact.
- `POST /Contacts/FilteredIds` — required: filterRequest(body) — Get ContactIds based on filter criteria (without OData)
- `GET /Contacts/Full` — Get all contacts.
- `GET /Contacts/New` — Get an empty contact.

## EventIssueCommunicationType (5)

- `POST /EventIssueCommunicationTypes` — required: request(body) — Creates a new communication type.
- `DELETE /EventIssueCommunicationTypes/{id}` — required: id(path) — Deletes a communication type.
- `PUT /EventIssueCommunicationTypes/{id}` — required: id(path), request(body) — Updates an existing communication type.
- `GET /EventIssueCommunicationTypes/Event/{eventId}` — required: eventId(path) — Gets communication types for an event.
- `GET /EventIssueCommunicationTypes/Object/{objectId}` — required: objectId(path) — Gets communication types for an object (Issue or SMS).

## Events (83)

- `DELETE /Events` — required: eventIds(body) — Flags all passed surveys as deleted.
- `GET /Events` — Gets all events
- `POST /Events` — Create a new event with an eventId
- `GET /Events/{eventId}` — required: eventId(path) — Gets an event2 by id.
- `POST /Events/{eventId}` — required: eventId(path), event2Dto(body) — Updates an event2 by id.
- `POST /Events/{eventId}/{property}` — required: eventId(path), property(path), value(body) — Update event property
- `POST /Events/{eventId}/AddDefaultContent` — required: eventId(path), contentType(query) — AddDefaultContent
- `POST /Events/{eventId}/AddFromList` — required: eventId(path), listId(query) — Adds all contacts from a list as participants
- `POST /Events/{eventId}/AddNewParticipant` — required: eventId(path), participant(body)
- `POST /Events/{eventId}/AddSpeakersToEvent` — required: eventId(path), eventSpeakers(body)
- `POST /Events/{eventId}/AddSponsorsToEvent` — required: eventId(path), eventSponsors(body)
- `POST /Events/{eventId}/attendance/AddNewParticipant` — required: eventId(path), participant(body)
- `POST /Events/{eventId}/attendance/CheckPublicPinCode` — required: eventId(path), userPinCode(body)
- `POST /Events/{eventId}/attendance/EnrichParticipants` — required: eventId(path), ids(body)
- `GET /Events/{eventId}/attendance/ExportParticipants` — required: eventId(path)
- `GET /Events/{eventId}/attendance/FullParticipantStatus` — required: eventId(path)
- `GET /Events/{eventId}/attendance/GetParticipants` — required: eventId(path)
- `GET /Events/{eventId}/attendance/GuestList` — required: eventId(path)
- `GET /Events/{eventId}/attendance/Language` — required: eventId(path)
- `GET /Events/{eventId}/attendance/ParticipantStates` — required: eventId(path)
- `POST /Events/{eventId}/attendance/UpdateParticipantStatus/{eventParticipantId}` — required: eventId(path), eventParticipantId(path), status(body)
- `POST /Events/{eventId}/BulkStatusChange` — required: eventId(path), request(body)
- `POST /Events/{eventId}/Copy` — required: eventId(path), eventCopySettings(body) — Create a new event from another
- `POST /Events/{eventId}/CreateEventSegment` — required: eventId(path), segmentRelation(body) — Create segment when needed
- `POST /Events/{eventId}/CreateOrUpdateEventSpeakers` — required: eventId(path), speaker(body)
- `POST /Events/{eventId}/CreateOrUpdateEventSponsors` — required: eventId(path), sponsor(body)
- `POST /Events/{eventId}/DeleteAttestationIssue` — required: eventId(path) — Delete ParticipantStatusIssue
- `DELETE /Events/{eventId}/DeleteEventSpeakers/{speakerId}` — required: eventId(path), speakerId(path)
- `DELETE /Events/{eventId}/DeleteEventSponsor/{sponsorId}` — required: eventId(path), sponsorId(path)
- `POST /Events/{eventId}/DeleteIssues` — required: eventId(path), deleteIssues(body) — Delete issues
- `POST /Events/{eventId}/DeleteParticipantStatusIssue` — required: eventId(path) — Delete ParticipantStatusIssue
- `POST /Events/{eventId}/DeleteSmsMessages` — required: eventId(path), smsMessagesToDelete(body)
- `POST /Events/{eventId}/DisconnectIssues` — required: eventId(path), issuesToDisconnect(body) — Disconnect issues from event
- `POST /Events/{eventId}/DisconnectSmsMessages` — required: eventId(path), smsMessagesToDisconnect(body)
- `POST /Events/{eventId}/DisconnectSurveys` — required: eventId(path), surveysToDisconnect(body) — Disconnect surveys from event
- `POST /Events/{eventId}/EndEvent` — required: eventId(path)
- `POST /Events/{eventId}/EventSpeakerOrdinal` — required: eventId(path), speakerListId(body)
- `POST /Events/{eventId}/EventSponsorOrdinal` — required: eventId(path), sponsorListId(body)
- `GET /Events/{eventId}/FullParticipantStatus` — required: eventId(path) — Gets the full participant status for an event
- `POST /Events/{eventId}/GetEventParticipantsWithChildren` — required: eventId(path), eventGuestListParentSearch(body)
- `GET /Events/{eventId}/ParticipantExport` — required: eventId(path)
- `GET /Events/{eventId}/Participants` — required: eventId(path) — Gets all participants for event
- `POST /Events/{eventId}/Participants/{participantId}/SendAttestationMail` — required: eventId(path), participantId(path) — Send confirmation mail
- `POST /Events/{eventId}/Participants/{participantId}/SendConfirmationMail` — required: eventId(path), participantId(path), status(body) — Send confirmation mail
- `POST /Events/{eventId}/PauseEvent` — required: eventId(path)
- `POST /Events/{eventId}/Publish` — required: eventId(path), scheduledObjects(body) — Publish an event
- `POST /Events/{eventId}/PublishEventSurvey` — required: eventId(path) — Publish event survey when it set to default and event is active
- `GET /Events/{eventId}/Registration/{contactId}` — required: eventId(path), contactId(path)
- `POST /Events/{eventId}/RemoveEventSensitiveAnswers` — required: eventId(path), surveyId(body)
- `DELETE /Events/{eventId}/RemoveParticipant/{eventParticipantId}` — required: eventId(path), eventParticipantId(path) — Remove participant from event
- `POST /Events/{eventId}/SendMultipleAttestationMail` — required: eventId(path) — Send attestation mail to all attesters
- `POST /Events/{eventId}/SendParticipantNotificationTest` — required: eventId(path), testMail(body) — Send a test mail
- `GET /Events/{eventId}/Speakers` — required: eventId(path) — Gets Event Speakers
- `GET /Events/{eventId}/Sponsors` — required: eventId(path) — Gets Event Speakers
- `POST /Events/{eventId}/StatusToAttended` — required: eventId(path), selectedParticipants(body) — Change selected participants status to attended
- `POST /Events/{eventId}/Tags` — required: eventId(path), tags(body)
- `POST /Events/{eventId}/Unpublish` — required: eventId(path) — UnPublish an event
- `POST /Events/{eventId}/UpdateEventParticipantInternalComment/{eventParticipantId}` — required: eventId(path), eventParticipantId(path), internalComment(body) — Update participant internal comment
- `POST /Events/{eventId}/UpdateExportList/{listId}` — required: eventId(path), listId(path)
- `POST /Events/{eventId}/UpdateParticipantStatus/{eventParticipantId}/{status}` — required: eventId(path), eventParticipantId(path), status(path), supressNotifications(body) — Update participant status
- `POST /Events/{issueId}/AbortScheduledIssue` — required: issueId(path)
- `POST /Events/CreateOrUpdateSpeakers` — required: speaker(body)
- `POST /Events/CreateOrUpdateSponsor` — required: sponsor(body)
- `GET /Events/Deleted` — Gets all deleted events
- `DELETE /Events/DeleteSpeakers/{speakerId}` — required: speakerId(path)
- `DELETE /Events/DeleteSponsor/{sponsorId}` — required: sponsorId(path)
- `GET /Events/Draft` — Gets all draft events
- `GET /Events/Ended` — Gets all published events
- `GET /Events/Listing` — Gets all event as listings
- `GET /Events/listItems` — required: page(query), pageSize(query), freeText(query), status(query), orderByValue(query), orderByDirection(query), tagIds(query)
- `GET /Events/ParticipantStates` — Gets all participant states
- `GET /Events/Paused` — Gets all published events
- `GET /Events/Published` — required: tagIds(query) — Gets all published events
- `GET /Events/Speakers` — Gets all Speakers
- `GET /Events/Sponsors` — Gets all Sponsors
- `POST /Events/SurveyAnswer/Create/{surveyResponseId}/{eventParticipantId}` — required: surveyResponseId(path), eventParticipantId(path), surveyAnswer(body) — Create survey answer
- `POST /Events/SurveyAnswer/Update/{eventParticipantId}` — required: eventParticipantId(path), surveyAnswer(body) — Update survey answer
- `GET /Events/SurveyResponse/{responseId}` — required: responseId(path) — Gets a full surveyResponse for display
- `GET /Events/SurveyResponse/History/{eventParticipantId}` — required: eventParticipantId(path) — Get event participant history data
- `DELETE /Events/Translations` — required: translation(body)
- `GET /Events/Translations` — required: eventId(query)
- `POST /Events/Translations/Create` — required: translation(body)
- `POST /Events/Translations/Update` — required: translation(body)

## ExtendedData (8)

- `GET /ExtendedData` — Gets all extended data items with paging
- `POST /ExtendedData` — required: item(body) — Creates a new extended data item
- `GET /ExtendedData/{type}` — required: type(path) — Gets all extended data items of a specific type on the account with paging
- `DELETE /ExtendedData/Item/{id}` — required: id(path) — Deletes an extended data item
- `GET /ExtendedData/Item/{id}` — required: id(path) — Gets a specific extended data item by ID
- `PUT /ExtendedData/Item/{id}` — required: id(path), item(body) — Updates an existing extended data item
- `GET /ExtendedData/mine` — Gets all extended data items created by the current user (no paging)
- `GET /ExtendedData/mine/{type}` — required: type(path) — Gets all extended data items of a specific type created by the current user with paging

## Imports (6)

- `POST /Imports` — required: import(body) — Creates an Import.
If the same contact (email/sms) is found more than once only the _first_ instance will be imported.
- `POST /Imports/AnalyzeColumns` — required: resource(body) — Takes a resource and tries to identify column headers.
- `POST /Imports/AnalyzeColumnsDataSource` — required: dataSource(body) — Takes a json/xml and tries to identify column headers.
- `POST /Imports/AnalyzeColumnsUrl` — required: import(body) — Takes a resource and tries to identify column headers.
- `POST /Imports/AnalyzeColumnsUrlDataSource` — required: import(body) — Takes a resource and tries to identify column headers.
- `POST /Imports/AnalyzeFile` — required: resource(body) — Takes a resource and tries to identify column headers.

## IssueRecipients (1)

- `GET /IssueRecipients/{issueRecipientId}` — required: issueRecipientId(path) — Gets an issue recipient

## Issues (30)

- `GET /Issues` — Gets all issues.
- `POST /Issues` — required: issue(body) — Creates an issue.

<p>Accepts null in which case a completely blank issue with default settings is created.</p>
- `GET /Issues/{id}` — required: id(path) — Gets an issue by its id.
- `POST /Issues/{id}/{property}` — required: id(path), property(path), value(body) — Updates an issue.
- `POST /Issues/{id}/Send` — required: id(path), sendIssue(body) — Schedules the issue for sending.
Date passed must be in UTC format.
- `GET /Issues/{id}/Sender` — required: id(path) — Gets the sender of the issue by finding a task for it.
- `GET /Issues/{issueId}/IssueRecipients/{issueRecipientId}` — required: issueId(path), issueRecipientId(path) — Gets an issue recipient
- `GET /Issues/{issueId}/SendOccasions/{occasionId}/Recipients` — required: issueId(path), occasionId(path) — Lists recipients for a specific send occasion.
- `POST /Issues/{issueId}/SendTransactional` — required: issueId(path), options(body) — Schedules the issue for sending a transactional email without  list connection.
- `GET /Issues/{issueId}/Statistics/Overview` — required: issueId(path) — Gets statistics for an issue.
- `GET /Issues/{issueId}/Statistics/UnsubscribeReasons` — required: issueId(path)
- `GET /Issues/all` — required: tagIds(query), categoryIds(query)
- `GET /Issues/AllNoneTemplates` — Gets all issues excluding templates.
- `GET /Issues/Draft` — required: tagIds(query), categoryIds(query)
- `GET /Issues/Failed` — required: tagIds(query), categoryIds(query)
- `GET /Issues/IssueVariation` — required: tagIds(query), categoryIds(query)
- `GET /Issues/Listing` — Gets all as listings
- `GET /Issues/Paused` — required: tagIds(query), categoryIds(query)
- `GET /Issues/PreviewDataSource` — required: variableName(query)
- `GET /Issues/Recipient` — Gets all issues sent to a contact by ContactId or ExternalId order by Scheduled descending.
- `GET /Issues/Scheduled` — required: tagIds(query), categoryIds(query)
- `GET /Issues/Sending` — required: tagIds(query), categoryIds(query)
- `GET /Issues/Sending/{issueId}` — required: issueId(path) — Gets sending issue with issueId.
- `GET /Issues/Sent` — required: tagIds(query), categoryIds(query)
- `GET /Issues/Sent/{issueId}/Statistics` — required: issueId(path)
- `GET /Issues/SentList` — required: tagIds(query), categoryIds(query)
- `GET /Issues/Statistics` — Gets statistics for all issues.
- `GET /Issues/Templates` — Gets all templates
- `GET /Issues/TemplatesListing` — required: tagIds(query), categoryIds(query)
- `POST /Issues/UnlinkJourney` — required: issueIds(body) — Removes any connected Journey as well as setting back the Issue status to Draft.

## Lists (11)

- `GET /Lists` — Gets all lists.
- `POST /Lists` — required: list(body) — Creates a new list in account
- `GET /Lists/{id}` — required: id(path) — Gets a list by its id.
- `POST /Lists/{id}/Clear` — required: id(path) — Clear a list.
- `DELETE /Lists/{listId}/ContactIds` — required: listId(path), contactIds(body) — Removes existing contact id(s) from list. No updates are made to the contacts themselves!
- `POST /Lists/{listId}/ContactIds` — required: listId(path), contactIds(body) — Adds existing contactids to list. No updates are made to the contacts themselves!
Much faster than than passing objects to /Lists/{ListId}/Contacts.
- `DELETE /Lists/{listId}/Contacts` — required: listId(path), contacts(body) — Removes existing contact(s) from list. No updates are made to the contacts themselves!
Recommended use is to only pass ContactId:s
- `GET /Lists/{listId}/Contacts` — required: listId(path) — Gets all contacts in this list.
- `POST /Lists/{listId}/Contacts` — required: listId(path), contacts(body) — Adds existing contact(s) to list. No updates are made to the contacts themselves!
Recommended use is to only pass ContactId:s
- `POST /Lists/{listId}/Import` — required: listId(path), contacts(body), clearlist(query) — Create a  new task-Import
- `GET /Lists/{listId}/Stats` — required: listId(path) — Gets contact statistics

## ProcessingTask (4)

- `GET /ProcessingTasks`
- `POST /ProcessingTasks/{id}/cancel` — required: id(path)
- `POST /ProcessingTasks/anonymizecontacts` — required: inactiveMonths(body)
- `POST /ProcessingTasks/mergecontacts`

## Surveys (19)

- `GET /Surveys` — Gets all surveys.
- `GET /Surveys/{surveyId}` — required: surveyId(path) — Gets a survey for editing
- `GET /Surveys/{surveyId}/IsActive` — required: surveyId(path) — Checks if a survey belongs to the current account and is active.
- `GET /Surveys/{surveyId}/QuestionOptions/{questionId}` — required: questionId(path), surveyId(path) — Gets all QuestionOptions.
- `GET /Surveys/{surveyId}/Questions` — required: surveyId(path) — Gets all surveysQuestions.
- `POST /Surveys/{surveyId}/RemoveSensitiveAnswers` — required: surveyId(path)
- `GET /Surveys/{surveyId}/Report` — required: surveyId(path), format(query) — Returns the survey data as a report.
- `GET /Surveys/{surveyId}/Responses` — required: surveyId(path) — Returns all responses for this survey
- `GET /Surveys/{surveyId}/Responses/{surveyResponseId}/Public` — required: surveyId(path), surveyResponseId(path) — Gets one response by id
- `GET /Surveys/{surveyId}/Statistics` — required: surveyId(path)
- `GET /Surveys/{surveyId}/Statistics/HasDeletedQuestions` — required: surveyId(path)
- `GET /Surveys/{surveyId}/Statistics/Public` — required: surveyId(path) — Gets a survey with full statistics filtered if filter is provided .
- `GET /Surveys/{surveyId}/Statistics/Summary` — required: surveyId(path) — Gets a survey for editing
- `GET /Surveys/Active` — Gets all surveys with status active and within date range.
- `GET /Surveys/Drafts` — Gets all surveys with status draft.
- `GET /Surveys/Ended` — Gets all surveys marked as ended or passed end date
- `GET /Surveys/Listing` — Gets all survey listings
- `GET /Surveys/Scheduled` — Gets all surveys with status active and within date range.
- `GET /Surveys/Summary` — Gets summarized surveys.

## Textmessages (22)

- `GET /Textmessages` — Gets all  SmsMessages.
- `POST /Textmessages` — required: smsMessage(body) — Creates an SmsMessage.

<p>Accepts null in which case a completely blank SmsMessage with default settings is created.</p>
- `GET /Textmessages/{id}` — required: id(path) — Gets an SmsMessage by its id.
- `POST /Textmessages/{id}/Clone` — required: id(path) — Clones a smsMessage as draft
- `POST /Textmessages/{id}/CloneTemplate` — required: id(path) — Clones a smsMessage template
- `GET /Textmessages/{id}/CountRecipients` — required: id(path)
- `POST /Textmessages/{id}/SaveAsTemplate` — required: id(path) — Clones a smsMessage as template
- `POST /Textmessages/{id}/Send` — required: id(path), sendSms(body) — Schedules the SMS for sending
- `GET /Textmessages/{id}/Statistics` — required: id(path) — Gets statistics for one SmsMessage.
- `POST /Textmessages/{smsId}/SendTransactional` — required: smsId(path), options(body) — Schedules the sms for sending.
- `GET /Textmessages/Aborted` — Gets all aborted messages.
- `GET /Textmessages/AllNoneTemplates` — Gets all SmsMessages, excluding templates, sorted by Modified descending.
- `GET /Textmessages/Drafts` — Gets all drafts (for editorversion 4 only).
- `GET /Textmessages/Listing` — Gets all sms listings (for editorversion 4 only).
- `GET /Textmessages/Listings/{smsMessageId}/Statistics` — required: smsMessageId(path) — Gets statistics for a text message.
- `GET /Textmessages/Paused` — Gets all paused messages
- `GET /Textmessages/Scheduled` — Gets all scheduled messages.
- `GET /Textmessages/Sending` — Gets all sending text messages.
- `GET /Textmessages/Sent` — Gets all sent messages.
- `GET /Textmessages/SmsRecived` — GetRecivesSms Gets all SmsRecived  by account
- `POST /Textmessages/Template` — Creates an SmsMessage with Template status.

<p>Always creates a completely blank SmsMessage with default settings and sets it to Template status.</p>
- `GET /Textmessages/Templates` — Gets all template messages.

## TrustedDevice (4)

- `GET /TrustedDevice`
- `DELETE /TrustedDevice/{id}` — required: id(path)
- `POST /TrustedDevice/Resend` — required: request(body)
- `POST /TrustedDevice/Verify` — required: request(body)

## TrustedDeviceAdmin (3)

- `POST /BackOffice/TrustedDevices/{id}/Approve` — required: id(path)
- `GET /BackOffice/TrustedDevices/Pending`
- `GET /BackOffice/TrustedDevices/Pending/ByUser/{userId}` — required: userId(path)

## Zapier (12)

- `POST /Zapier/{id}/Send` — required: id(path), scheduleForSending(body) — Schedules the issue for sending.
Date passed must be in UTC format.
- `POST /Zapier/Contacts` — required: contact(body) — Upsert contact. If found updates otherwise creates.
- `GET /Zapier/Contacts/{contactId}` — required: contactId(path)
- `POST /Zapier/Contacts/{contactId}` — required: contact(body), contactId(path) — Updates the contact
- `GET /Zapier/Contacts/Find` — required: contactId(query), externalId(query), email(query), smsNumber(query) — Find the contact
- `POST /Zapier/Issues/{issueId}/SendTransactional` — required: issueId(path), options(body) — Schedules the issue for sending a transactional email without list connection.
- `GET /Zapier/Issues/ForTransactional` — Gets issues that can be used for transactional sending (ie. Sent).
- `POST /Zapier/Lists` — required: list(body)
- `GET /Zapier/Lists/{listId}` — required: listId(path) — Gets a list by its id.
- `POST /Zapier/Lists/{listId}/ContactIds` — required: listId(path), contact(body)
- `GET /Zapier/Lists/Find` — required: name(query)
- `GET /Zapier/Users/Current` — Gets the current user. Used by Zapier to verify that the connection is authenticated correctly.

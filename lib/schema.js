// Single source of truth: drives DB tables, API validation and forms.
const X = (k, l, t = "text", req, r) => ({ k, l, t, req, r });
const S = (k, l, o, req) => ({ k, l, t: "select", o, req });
const W = (k, l) => ({ k, l, t: "who" });
const AV = ["unknown", "available", "not_available"];
export const DONE_ITEM = ["purchased", "delivered", "set_up", "cancelled", "no_longer_needed"];
export const MET = ["location", "value", "security", "water", "comfort"];
const R = [1, 5];
export const T = {
  properties: { lab: "title", cols: ["title", "status", "rent", "deposit", "viewing_planned", "viewing_actual"], f: [
    X("title", "Title", "text", 1),
    S("status", "Status", ["shortlisted", "to_visit", "scheduled", "visited", "under_consideration", "selected", "rejected"], 1),
    X("rent", "Monthly rent (KES)", "number"), X("deposit", "Deposit (KES)", "number"), X("agent_fee", "Agent fee (KES)", "number"),
    X("other_fees", "Other monthly fees (KES)", "number"), X("bedrooms", "Bedrooms", "number"), X("bathrooms", "Bathrooms", "number"),
    S("gym", "Gym", AV), S("pool", "Pool", AV), S("generator", "Generator", AV), S("parking", "Parking", AV),
    X("address", "Address"), X("listing_url", "Listing URL"),
    X("viewing_planned", "Viewing planned", "date"), X("viewing_actual", "Actually visited", "date"),
    X("contact", "Agent / contact (name, phone)"), X("notes", "Notes")] },
  reviews: { lab: "reviewer", cols: ["property_id", "reviewer", "location", "value", "security", "water", "comfort"], f: [
    { k: "property_id", l: "Property", t: "ref", ref: "properties", req: 1 }, { ...W("reviewer", "Reviewer"), req: 1 },
    X("location", "Location (1-5)", "number", 0, R), X("value", "Value (1-5)", "number", 0, R), X("security", "Security (1-5)", "number", 0, R),
    X("water", "Water (1-5)", "number", 0, R), X("comfort", "Comfort (1-5)", "number", 0, R), X("comment", "Comment")] },
  items: { lab: "name", cols: ["name", "category", "status", "timing", "qty", "estimated_price", "target_date"], f: [
    X("name", "Item", "text", 1),
    S("category", "Category", ["Bedroom", "Living room", "Kitchen", "Bathroom", "Cleaning supplies", "Electronics and appliances", "Furniture", "Decor", "Utilities and essentials", "Moving and transportation"], 1),
    S("acquisition", "Acquisition", ["buy_new", "buy_second_hand", "owned", "borrowed", "gifted"], 1),
    S("status", "Status", ["needed", "researching", "considering", "planned", "purchased", "delivered", "set_up", "cancelled", "no_longer_needed"], 1),
    S("timing", "When needed", ["essential_before_move", "shortly_after_move", "later", "optional"], 1),
    X("qty", "Quantity", "number", 1), X("estimated_price", "Estimated price (KES)", "number"), X("actual_price", "Actual price (KES)", "number"),
    X("target_date", "Target purchase date", "date"), W("assigned", "Assigned to"), X("vendor", "Vendor / store"), X("url", "Product URL"), X("notes", "Notes")] },
  expenses: { lab: "description", cols: ["description", "amount", "kind", "status", "paid_by", "split", "spent_on"], f: [
    X("description", "Description", "text", 1), X("amount", "Amount (KES)", "number", 1),
    S("kind", "Type", ["expense", "refundable_deposit"], 1),
    S("status", "Status", ["estimated", "pending", "committed", "paid", "refunded", "cancelled"], 1),
    W("paid_by", "Paid by"), S("split", "Split", ["equal", "custom"], 1),
    X("share_a", "Person A's share (custom split only)", "number"), X("spent_on", "Date", "date"),
    X("category", "Category"), X("notes", "Notes")] },
  settlements: { lab: "who_from", cols: ["who_from", "who_to", "amount", "paid_on"], f: [
    { ...W("who_from", "Paid by"), req: 1 }, { ...W("who_to", "Paid to"), req: 1 }, X("amount", "Amount (KES)", "number", 1), X("paid_on", "Date", "date")] },
  tasks: { lab: "title", cols: ["title", "phase", "status", "priority", "due_date", "assigned"], f: [
    X("title", "Task", "text", 1),
    S("phase", "Phase", ["Preparation and research", "House hunting", "Securing the property", "Purchasing and preparation", "Moving day", "Settling in", "Ongoing household"], 1),
    S("status", "Status", ["pending", "in_progress", "completed", "blocked", "postponed"], 1),
    S("priority", "Priority", ["critical", "high", "medium", "low"], 1),
    X("due_date", "Deadline", "date"), W("assigned", "Assigned to"),
    { k: "depends_on", l: "Can't finish until this task is done", t: "ref", ref: "tasks" }, X("notes", "Notes")] },
};

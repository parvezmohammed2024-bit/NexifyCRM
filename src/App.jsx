import { useState, useEffect, useRef } from "react";
import { Users, Briefcase, TrendingUp, Plus, X, Pencil, Trash2, Search, LayoutDashboard, Target, Phone, Mail, Globe, ChevronDown, ChevronUp, Upload, FileSpreadsheet, Download, MessageCircle, Clock, Flame, CalendarClock, ListChecks, Banknote, FileText, AlertTriangle, Columns, List, Check, Sparkles, Link } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";
import { LogOut, History, Lock, Bell } from "lucide-react";

const STAGES = ["New", "Contacted", "Proposal Sent", "Negotiating", "Closed Won", "Closed Lost"];
const STAGE_PROB = { "New": 0.1, "Contacted": 0.25, "Proposal Sent": 0.5, "Negotiating": 0.75, "Closed Won": 1, "Closed Lost": 0 };
const STAGE_COLORS = {
  "New": "bg-blue-50 text-blue-700 border-blue-200",
  "Contacted": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Proposal Sent": "bg-amber-50 text-amber-700 border-amber-200",
  "Negotiating": "bg-purple-50 text-purple-700 border-purple-200",
  "Closed Won": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Closed Lost": "bg-gray-100 text-gray-500 border-gray-200",
};
const SERVICES = ["SEO", "Social Media Management", "Web Development", "Paid Ads", "Branding", "AI Automation", "Email Marketing", "Content Creation"];
const SOURCES = ["Cold Outreach", "LinkedIn", "Referral", "Website", "WhatsApp", "Clutch", "Other"];
const NICHES = ["Education", "Travel & Tourism", "F&B / Restaurant", "E-commerce", "Real Estate", "Healthcare", "Fashion & Apparel", "Manufacturing", "Professional Services", "Fitness & Wellness", "Technology", "Other"];
const TASK_TYPES = ["Call", "Email", "LinkedIn", "Meeting", "Other"];
// The super admin is always an Executive and can never be locked out.
const SUPER_ADMIN = "parvezmohammed2024@gmail.com";
const PRIORITIES = ["Low", "Medium", "High"];
const PRIORITY_COLORS = { "Low": "bg-gray-100 text-gray-500 border-gray-200", "Medium": "bg-amber-50 text-amber-700 border-amber-200", "High": "bg-red-50 text-red-600 border-red-200" };

const emptyLead = { name: "", company: "", country: "", email: "", phone: "", website: "", source: "Cold Outreach", service: "SEO", value: "", stage: "New", category: "", nextFollowUp: "", owner: "", notes: "" };
const emptyClient = { name: "", company: "", country: "", email: "", phone: "", retainer: "", services: "", startDate: "", lastContact: "", category: "", notes: "" };

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => {
  const v = parseFloat(n);
  if (isNaN(v)) return "RM 0";
  return "RM " + Math.round(v).toLocaleString();
};
const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return null;
  return Math.floor((new Date(todayStr() + "T00:00:00") - d) / 86400000);
};
const waDigits = (phone) => (phone || "").replace(/[^0-9]/g, "");

const leadScore = (l) => {
  if (l.stage === "Closed Won" || l.stage === "Closed Lost") return null;
  let pts = 0;
  if (l.stage === "Contacted") pts += 1;
  if (l.stage === "Proposal Sent") pts += 2;
  if (l.stage === "Negotiating") pts += 3;
  if (parseFloat(l.value) >= 3000) pts += 1;
  const acts = l.activities || [];
  const lastAct = acts.length ? acts[0].date : l.createdAt;
  const ds = daysSince(lastAct);
  if (ds !== null && ds <= 7) pts += 1;
  if (ds !== null && ds > 21) pts -= 1;
  if (pts >= 3) return { label: "Hot", cls: "bg-red-50 text-red-600 border-red-200", icon: true };
  if (pts >= 1) return { label: "Warm", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: false };
  return { label: "Cold", cls: "bg-sky-50 text-sky-600 border-sky-200", icon: false };
};

export default function NexifyCRM() {
  const [tab, setTab] = useState("dashboard");
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyLead);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [nicheFilter, setNicheFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [saveState, setSaveState] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState("");
  const [skipDup, setSkipDup] = useState(true);
  const [importNiche, setImportNiche] = useState("");
  const [bulkNiche, setBulkNiche] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [view, setView] = useState("list");
  const [expandedLead, setExpandedLead] = useState(null);
  const [expandedClient, setExpandedClient] = useState(null);
  const [activityText, setActivityText] = useState("");
  const [taskText, setTaskText] = useState("");
  const [taskModal, setTaskModal] = useState(false);
  const [taskEditId, setTaskEditId] = useState(null);
  const [taskForm, setTaskForm] = useState({ clientId: "", type: "Call", title: "", description: "", due: "", dueTime: "", priority: "Medium", assignee: "" });
  const [completing, setCompleting] = useState(null); // { clientId, taskId }
  const [proofLink, setProofLink] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [proofImage, setProofImage] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [taskTypeFilter, setTaskTypeFilter] = useState("All");
  const [taskDue, setTaskDue] = useState("");
  const [payMonth, setPayMonth] = useState(todayStr().slice(0, 7));
  const [payAmount, setPayAmount] = useState("");
  const [dragId, setDragId] = useState(null);
  const fileInputRef = useRef(null);

  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [auditLog, setAuditLog] = useState([]);
  const [generalTasks, setGeneralTasks] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [roles, setRoles] = useState({});
  const [profiles, setProfiles] = useState({});
  const [logoUrl, setLogoUrl] = useState("");
  const [taskTypes, setTaskTypes] = useState(TASK_TYPES);
  const [newTypeText, setNewTypeText] = useState("");
  const [profileModal, setProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", avatar: "" });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => {
    try { return localStorage.getItem("nexify-bell-seen") || ""; } catch { return ""; }
  });

  const loadData = async (email) => {
    try {
      const { data } = await supabase.from("crm_data").select("data").eq("id", 1).single();
      const d = (data && data.data) || {};
      const L = (d.leads || []).map((l) => ({ activities: [], nextFollowUp: "", ...l }));
      const C = (d.clients || []).map((c) => ({ tasks: [], payments: [], ...c }));
      const G = d.generalTasks || [];
      const R = d.roles || {};
      const P = d.profiles || {};
      const LOGO = d.logoUrl || "";
      const TT = (d.taskTypes && d.taskTypes.length) ? d.taskTypes : TASK_TYPES;
      let CK = d.checkins || [];
      setLeads(L);
      setClients(C);
      setGeneralTasks(G);
      setRoles(R);
      setProfiles(P);
      setLogoUrl(LOGO);
      setTaskTypes(TT);
      // Auto daily check-in: logging in once a day records the user's attendance
      const today = todayStr();
      if (email && !CK.some((c) => c.email === email && c.date === today)) {
        CK = [...CK, { email, date: today }];
        try {
          await supabase.from("crm_data").update({ data: { leads: L, clients: C, generalTasks: G, roles: R, profiles: P, logoUrl: LOGO, taskTypes: TT, checkins: CK }, updated_at: new Date().toISOString() }).eq("id", 1);
          await supabase.from("audit_log").insert({ user_email: email, action: `checked in for ${today}` });
        } catch (e) {}
      }
      setCheckins(CK);
    } catch (e) {}
    setLoaded(true);
  };

  const loadAudit = async () => {
    try {
      const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      setAuditLog(data || []);
    } catch (e) {}
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
      if (data.session) { loadData(data.session.user.email); loadAudit(); loadChat(); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      if (sess) { loadData(sess.user.email); loadAudit(); loadChat(); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Poll chat while on the Chat tab (works even without realtime enabled)
  useEffect(() => {
    if (tab !== "chat" || !session) return;
    loadChat();
    const iv = setInterval(loadChat, 4000);
    return () => clearInterval(iv);
  }, [tab, session]);

  // Members can see everything except Leads and Clients — bounce them off those
  useEffect(() => {
    if (!session || !loaded) return;
    const email = session?.user?.email || "";
    const r = roles[email] || (email === SUPER_ADMIN ? "Executive" : "Member");
    if (r !== "Executive" && ["leads", "clients", "team", "reports", "history"].includes(tab)) {
      setTab("dashboard");
    }
  }, [tab, roles, session, loaded]);


  const callAI = async (prompt, maxTokens) => {
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, max_tokens: maxTokens || 1500 }),
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || "AI failed");
    return data.text || "";
  };

  const logAudit = async (action) => {
    const email = session?.user?.email || "unknown";
    try {
      await supabase.from("audit_log").insert({ user_email: email, action });
      setAuditLog((prev) => [{ id: Date.now(), user_email: email, action, created_at: new Date().toISOString() }, ...prev]);
    } catch (e) {}
  };

  const persist = async (newLeads = leads, newClients = clients, newGeneral = generalTasks, newCheckins = checkins, newRoles = roles, newProfiles = profiles, newLogo = logoUrl, newTaskTypes = taskTypes) => {
    try {
      setSaveState("saving");
      const { error } = await supabase.from("crm_data").update({ data: { leads: newLeads, clients: newClients, generalTasks: newGeneral, checkins: newCheckins, roles: newRoles, profiles: newProfiles, logoUrl: newLogo, taskTypes: newTaskTypes }, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) throw error;
      setSaveState("saved");
      setTimeout(() => setSaveState(""), 1500);
    } catch (e) {
      setSaveState("error");
    }
  };

  const loadChat = async () => {
    try {
      const { data } = await supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(200);
      setChatMessages(data || []);
    } catch (e) {}
  };

  const sendChat = async () => {
    if (!chatText.trim()) return;
    const email = session?.user?.email || "unknown";
    const text = chatText.trim();
    setChatText("");
    try {
      await supabase.from("chat_messages").insert({ user_email: email, text });
      loadChat();
    } catch (e) {}
  };

  const setUserRole = (email, role) => {
    const newRoles = { ...roles, [email]: role };
    setRoles(newRoles);
    persist(leads, clients, generalTasks, checkins, newRoles);
    logAudit(`set ${ownerName(email)}'s role to ${role}`);
  };

  const addTaskType = () => {
    const name = newTypeText.trim();
    if (!name || taskTypes.includes(name)) { setNewTypeText(""); return; }
    const newTypes = [...taskTypes, name];
    setTaskTypes(newTypes);
    persist(leads, clients, generalTasks, checkins, roles, profiles, logoUrl, newTypes);
    logAudit(`added task type "${name}"`);
    setNewTypeText("");
  };

  const removeTaskType = (name) => {
    const newTypes = taskTypes.filter((t) => t !== name);
    setTaskTypes(newTypes);
    persist(leads, clients, generalTasks, checkins, roles, profiles, logoUrl, newTypes);
    logAudit(`removed task type "${name}"`);
  };

  const sendEmail = async (to, subject, html) => {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html }),
      });
    } catch (e) {}
  };

  const notifyAssignment = (task, clientLabel) => {
    const to = task.assignee;
    if (!to || to === myEmail) return;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
        <h2 style="color:#4f46e5;">New task assigned to you</h2>
        <p style="color:#555;"><b>${(task.title || "").replace(/</g, "&lt;")}</b> (${task.type})</p>
        <p style="color:#555;">For: ${clientLabel}${task.due ? ` &middot; Due: ${task.due}` : ""}${task.priority ? ` &middot; Priority: ${task.priority}` : ""}</p>
        ${task.description ? `<p style="color:#777;">${task.description.replace(/</g, "&lt;")}</p>` : ""}
        <p style="margin-top:20px;"><a href="https://nexify-crm.vercel.app" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Open Nexify CRM</a></p>
      </div>`;
    sendEmail(to, `New task: ${task.title}`, html);
  };

  const sendRemindersNow = async () => {
    const open = realTasks.filter((t) => !t.done && t.assignee);
    const byUser = {};
    open.forEach((t) => { (byUser[t.assignee] = byUser[t.assignee] || []).push(t); });
    const emails = Object.keys(byUser);
    if (!emails.length) { setToast("No pending tasks to remind about."); setTimeout(() => setToast(""), 3000); return; }
    setToast(`Sending reminders to ${emails.length} member${emails.length !== 1 ? "s" : ""}…`);
    for (const email of emails) {
      const list = byUser[email].sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
      const rows = list.map((t) => {
        const late = t.due && t.due < todayStr();
        return `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">${t.type}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${(t.title || "").replace(/</g, "&lt;")}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${t.who}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;color:${late ? "#dc2626" : "#666"};">${t.due || "—"}${late ? " (overdue)" : ""}</td></tr>`;
      }).join("");
      const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;"><h2 style="color:#4f46e5;">Hi ${ownerName(email)}, your task reminder</h2><p style="color:#555;">You have <b>${list.length}</b> open task${list.length !== 1 ? "s" : ""}.</p><table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody>${rows}</tbody></table><p style="margin-top:20px;"><a href="https://nexify-crm.vercel.app" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Open Nexify CRM</a></p></div>`;
      await sendEmail(email, `Task reminder — ${list.length} open`, html);
    }
    logAudit(`sent task reminders to ${emails.length} member(s)`);
    setToast(`Reminders sent to ${emails.length} member${emails.length !== 1 ? "s" : ""}.`);
    setTimeout(() => setToast(""), 4000);
  };

  const openProfile = () => {
    const p = profiles[session?.user?.email] || {};
    setProfileForm({ name: p.name || "", avatar: p.avatar || "" });
    setProfileModal(true);
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("proofs").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("proofs").getPublicUrl(path);
      setProfileForm((f) => ({ ...f, avatar: data.publicUrl }));
    } catch (err) {
      setToast("Photo upload failed — try a smaller image.");
      setTimeout(() => setToast(""), 3500);
    }
    setUploadingAvatar(false);
    e.target.value = "";
  };

  const saveProfile = () => {
    const email = session?.user?.email;
    if (!email) return;
    const newProfiles = { ...profiles, [email]: { name: profileForm.name.trim(), avatar: profileForm.avatar } };
    setProfiles(newProfiles);
    persist(leads, clients, generalTasks, checkins, roles, newProfiles);
    logAudit(`updated their profile`);
    setProfileModal(false);
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("proofs").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("proofs").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      persist(leads, clients, generalTasks, checkins, roles, profiles, data.publicUrl);
      logAudit(`updated the CRM logo`);
    } catch (err) {
      setToast("Logo upload failed — try a smaller image.");
      setTimeout(() => setToast(""), 3500);
    }
    setUploadingLogo(false);
    e.target.value = "";
  };

  const openAdd = (type) => {
    setForm(type === "lead" ? { ...emptyLead } : { ...emptyClient });
    setEditId(null);
    setModal(type);
  };

  const openEdit = (type, item) => {
    setForm({ ...item });
    setEditId(item.id);
    setModal(type);
  };

  const saveItem = () => {
    if (!form.company.trim() && !form.name.trim()) return;
    if (modal === "lead") {
      let newLeads;
      if (editId) {
        newLeads = leads.map((l) => (l.id === editId ? { ...l, ...form, id: editId } : l));
      } else {
        newLeads = [{ ...form, owner: form.owner || session?.user?.email || "", id: Date.now(), createdAt: todayStr(), activities: [] }, ...leads];
      }
      setLeads(newLeads);
      persist(newLeads, clients);
      logAudit(`${editId ? "edited" : "added"} lead "${form.company || form.name}"`);
    } else {
      let newClients;
      if (editId) {
        newClients = clients.map((c) => (c.id === editId ? { ...c, ...form, id: editId } : c));
      } else {
        newClients = [{ ...form, id: Date.now(), tasks: [], payments: [] }, ...clients];
      }
      setClients(newClients);
      persist(leads, newClients);
      logAudit(`${editId ? "edited" : "added"} client "${form.company || form.name}"`);
    }
    setModal(null);
  };

  const deleteItem = (type, id) => {
    if (type === "lead") {
      const target = leads.find((l) => l.id === id);
      const newLeads = leads.filter((l) => l.id !== id);
      setLeads(newLeads);
      persist(newLeads, clients);
      logAudit(`deleted lead "${target?.company || target?.name || id}"`);
    } else {
      const target = clients.find((c) => c.id === id);
      const newClients = clients.filter((c) => c.id !== id);
      setClients(newClients);
      persist(leads, newClients);
      logAudit(`deleted client "${target?.company || target?.name || id}"`);
    }
  };

  const updateStage = (id, stage) => {
    const newLeads = leads.map((l) => {
      if (l.id !== id) return l;
      const upd = { ...l, stage };
      if (stage === "Proposal Sent" && !l.proposalDate) upd.proposalDate = todayStr();
      upd.activities = [{ id: Date.now(), date: todayStr(), text: `Stage changed to ${stage}` }, ...(l.activities || [])];
      return upd;
    });
    setLeads(newLeads);
    persist(newLeads, clients);
    const t = leads.find((l) => l.id === id);
    logAudit(`moved "${t?.company || t?.name || id}" to ${stage}`);
  };

  const addActivity = (leadId) => {
    if (!activityText.trim()) return;
    const newLeads = leads.map((l) =>
      l.id === leadId ? { ...l, activities: [{ id: Date.now(), date: todayStr(), text: activityText.trim() }, ...(l.activities || [])] } : l
    );
    setLeads(newLeads);
    persist(newLeads, clients);
    setActivityText("");
  };

  const setFollowUp = (leadId, date) => {
    const newLeads = leads.map((l) => (l.id === leadId ? { ...l, nextFollowUp: date } : l));
    setLeads(newLeads);
    persist(newLeads, clients);
  };

  const openTaskModal = () => {
    setTaskEditId(null);
    setTaskForm({ clientId: "general", type: "Call", title: "", description: "", due: todayStr(), dueTime: "", priority: "Medium", assignee: session?.user?.email || "" });
    setTaskModal(true);
  };

  const openEditTask = (t) => {
    setTaskEditId({ clientId: t.clientId, taskId: t.id });
    setTaskForm({
      clientId: t.clientId === "general" ? "general" : String(t.clientId),
      type: t.type || "Call", title: t.title || t.text || "", description: t.description || "",
      due: t.due || "", dueTime: t.dueTime || "", priority: t.priority || "Medium", assignee: t.assignee || "",
    });
    setTaskModal(true);
  };

  const deleteAnyTask = (clientId, taskId) => {
    if (clientId === "general") {
      const newGeneral = generalTasks.filter((t) => t.id !== taskId);
      setGeneralTasks(newGeneral);
      persist(leads, clients, newGeneral);
    } else {
      const newClients = clients.map((c) => (c.id === clientId ? { ...c, tasks: (c.tasks || []).filter((t) => t.id !== taskId) } : c));
      setClients(newClients);
      persist(leads, newClients);
    }
    logAudit(`deleted a task`);
  };

  const createTask = () => {
    if (!taskForm.title.trim()) return;
    // EDIT MODE: update existing task in place (Executives)
    if (taskEditId) {
      const fields = {
        title: taskForm.title.trim(), type: taskForm.type, description: taskForm.description.trim(),
        due: taskForm.due, dueTime: taskForm.dueTime, priority: taskForm.priority, assignee: taskForm.assignee,
      };
      // Remove from old location, add to new (in case client association changed)
      const old = taskEditId;
      // strip from old
      let g = generalTasks, cl = clients, moved = null;
      if (old.clientId === "general") {
        moved = generalTasks.find((t) => t.id === old.taskId);
        g = generalTasks.filter((t) => t.id !== old.taskId);
      } else {
        const oc = clients.find((c) => c.id === old.clientId);
        moved = (oc?.tasks || []).find((t) => t.id === old.taskId);
        cl = clients.map((c) => (c.id === old.clientId ? { ...c, tasks: (c.tasks || []).filter((t) => t.id !== old.taskId) } : c));
      }
      const updated = { ...(moved || { id: old.taskId, done: false }), ...fields };
      if (!taskForm.clientId || taskForm.clientId === "general") {
        g = [...g, updated];
      } else {
        const cid = Number(taskForm.clientId);
        cl = cl.map((c) => (c.id === cid ? { ...c, tasks: [...(c.tasks || []), updated] } : c));
      }
      setGeneralTasks(g);
      setClients(cl);
      persist(leads, cl, g);
      logAudit(`edited task "${fields.title}"`);
      setTaskModal(false);
      setTaskEditId(null);
      return;
    }
    const newTask = {
      id: Date.now(),
      title: taskForm.title.trim(),
      type: taskForm.type,
      description: taskForm.description.trim(),
      due: taskForm.due,
      dueTime: taskForm.dueTime,
      priority: taskForm.priority,
      assignee: taskForm.assignee || session?.user?.email || "",
      done: false,
    };
    if (!taskForm.clientId || taskForm.clientId === "general") {
      const newGeneral = [...generalTasks, newTask];
      setGeneralTasks(newGeneral);
      persist(leads, clients, newGeneral);
      logAudit(`created ${taskForm.type} general task "${newTask.title}"`);
      notifyAssignment(newTask, "General / internal");
    } else {
      const cid = Number(taskForm.clientId);
      const client = clients.find((c) => c.id === cid);
      const newClients = clients.map((c) => (c.id === cid ? { ...c, tasks: [...(c.tasks || []), newTask] } : c));
      setClients(newClients);
      persist(leads, newClients);
      logAudit(`created ${taskForm.type} task "${newTask.title}" for ${client?.company || client?.name || "a client"}`);
      notifyAssignment(newTask, client?.company || client?.name || "a client");
    }
    setTaskModal(false);
  };

  // Quick-add from a client card (simple task)
  const addTask = (clientId) => {
    if (!taskText.trim()) return;
    const newClients = clients.map((c) =>
      c.id === clientId ? { ...c, tasks: [...(c.tasks || []), { id: Date.now(), title: taskText.trim(), type: "Other", due: taskDue, priority: "Medium", assignee: session?.user?.email || "", done: false }] } : c
    );
    setClients(newClients);
    persist(leads, newClients);
    setTaskText("");
    setTaskDue("");
  };

  // Completing a task requires proof of work; un-completing is instant.
  const toggleTask = (clientId, taskId) => {
    if (clientId === "general") {
      const task = generalTasks.find((t) => t.id === taskId);
      if (task && !task.done) { setProofLink(""); setProofNote(""); setProofImage(""); setCompleting({ clientId, taskId }); return; }
      const newGeneral = generalTasks.map((t) => (t.id === taskId ? { ...t, done: false, proofLink: "", proofNote: "", completedAt: null, completedBy: null } : t));
      setGeneralTasks(newGeneral);
      persist(leads, clients, newGeneral);
      return;
    }
    const client = clients.find((c) => c.id === clientId);
    const task = (client?.tasks || []).find((t) => t.id === taskId);
    if (task && !task.done) {
      setProofLink("");
      setProofNote(""); setProofImage("");
      setCompleting({ clientId, taskId });
      return;
    }
    const newClients = clients.map((c) =>
      c.id === clientId ? { ...c, tasks: (c.tasks || []).map((t) => (t.id === taskId ? { ...t, done: false, proofLink: "", proofNote: "", completedAt: null, completedBy: null } : t)) } : c
    );
    setClients(newClients);
    persist(leads, newClients);
  };

  const uploadProofImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `proof-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("proofs").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("proofs").getPublicUrl(path);
      setProofImage(data.publicUrl);
    } catch (err) {
      setToast("Image upload failed — you can still use a link or note.");
      setTimeout(() => setToast(""), 3500);
    }
    setUploadingProof(false);
    e.target.value = "";
  };

  const confirmComplete = () => {
    if (!completing) return;
    if (!proofLink.trim() && !proofNote.trim() && !proofImage) return; // require some proof
    const { clientId, taskId } = completing;
    const patch = (t) => ({ ...t, done: true, proofLink: proofLink.trim(), proofNote: proofNote.trim(), proofImage, completedAt: new Date().toISOString(), completedBy: session?.user?.email || "" });
    if (clientId === "general") {
      const task = generalTasks.find((t) => t.id === taskId);
      const newGeneral = generalTasks.map((t) => (t.id === taskId ? patch(t) : t));
      setGeneralTasks(newGeneral);
      persist(leads, clients, newGeneral);
      logAudit(`completed general task "${task?.title || ""}"${proofLink.trim() ? ` (proof: ${proofLink.trim()})` : ""}`);
    } else {
      const client = clients.find((c) => c.id === clientId);
      const task = (client?.tasks || []).find((t) => t.id === taskId);
      const newClients = clients.map((c) =>
        c.id === clientId ? { ...c, tasks: (c.tasks || []).map((t) => (t.id === taskId ? patch(t) : t)) } : c
      );
      setClients(newClients);
      persist(leads, newClients);
      logAudit(`completed task "${task?.title || task?.text || ""}"${proofLink.trim() ? ` (proof: ${proofLink.trim()})` : ""}`);
    }
    setCompleting(null);
    setProofLink("");
    setProofNote(""); setProofImage("");
  };

  const deleteTask = (clientId, taskId) => {
    const newClients = clients.map((c) =>
      c.id === clientId ? { ...c, tasks: (c.tasks || []).filter((t) => t.id !== taskId) } : c
    );
    setClients(newClients);
    persist(leads, newClients);
  };

  const addPayment = (clientId) => {
    const amt = parseFloat(payAmount);
    if (!payMonth || isNaN(amt) || amt <= 0) return;
    const newClients = clients.map((c) =>
      c.id === clientId ? { ...c, payments: [...(c.payments || []), { id: Date.now(), month: payMonth, amount: amt }] } : c
    );
    setClients(newClients);
    persist(leads, newClients);
    setPayAmount("");
  };

  const deletePayment = (clientId, payId) => {
    const newClients = clients.map((c) =>
      c.id === clientId ? { ...c, payments: (c.payments || []).filter((p) => p.id !== payId) } : c
    );
    setClients(newClients);
    persist(leads, newClients);
  };

  const convertToClient = (lead) => {
    const newClient = {
      id: Date.now(),
      name: lead.name, company: lead.company, country: lead.country,
      email: lead.email, phone: lead.phone,
      retainer: lead.value, services: lead.service,
      category: lead.category || "",
      owner: lead.owner || "",
      startDate: todayStr(), lastContact: todayStr(),
      notes: lead.notes, tasks: [], payments: [],
    };
    const newClients = [newClient, ...clients];
    const newLeads = leads.map((l) => (l.id === lead.id ? { ...l, stage: "Closed Won", activities: [{ id: Date.now(), date: todayStr(), text: "Deal won — converted to client" }, ...(l.activities || [])] } : l));
    setClients(newClients);
    setLeads(newLeads);
    persist(newLeads, newClients);
    logAudit(`converted "${lead.company || lead.name}" to a client`);
    setTab("clients");
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const leadRows = leads.map((l) => ({
      Company: l.company, Contact: l.name, Niche: l.category, Country: l.country, Email: l.email, Phone: l.phone, Website: l.website || "",
      Source: l.source, Service: l.service, "Value (RM)": l.value, Stage: l.stage, "Next follow-up": l.nextFollowUp,
      Created: l.createdAt, Notes: l.notes,
    }));
    const clientRows = clients.map((c) => ({
      Company: c.company, Contact: c.name, Niche: c.category, Country: c.country, Email: c.email, Phone: c.phone,
      "Retainer (RM)": c.retainer, Services: c.services, "Start date": c.startDate, "Last contact": c.lastContact,
      "Total paid (RM)": (c.payments || []).reduce((s, p) => s + p.amount, 0), Notes: c.notes,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leadRows.length ? leadRows : [{}]), "Leads");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientRows.length ? clientRows : [{}]), "Clients");
    XLSX.writeFile(wb, `nexify-crm-${todayStr()}.xlsx`);
  };

  const matchCol = (headers, keywords) => {
    const idx = headers.findIndex((h) => keywords.some((k) => String(h).toLowerCase().replace(/[^a-z]/g, "").includes(k)));
    return idx === -1 ? null : idx;
  };

  const normStage = (v) => {
    const s = String(v || "").toLowerCase();
    if (s.includes("won")) return "Closed Won";
    if (s.includes("lost") || s.includes("reject")) return "Closed Lost";
    if (s.includes("negot")) return "Negotiating";
    if (s.includes("proposal") || s.includes("quote") || s.includes("quotation")) return "Proposal Sent";
    if (s.includes("contact") || s.includes("follow") || s.includes("replied")) return "Contacted";
    return "New";
  };

  const HEADER_KEYWORDS = ["company", "name", "email", "phone", "whatsapp", "mobile", "contact", "country", "city", "source", "industry", "niche", "category", "sector", "website", "url", "stage", "status", "value", "budget", "lead", "service", "business", "note", "remark"];

  const detectHeaderRow = (aoa) => {
    let best = -1, bestScore = 0;
    aoa.slice(0, 20).forEach((row, i) => {
      const score = row.filter((cell) => typeof cell === "string" && cell.trim() && HEADER_KEYWORDS.some((k) => cell.toLowerCase().replace(/[^a-z]/g, "").includes(k))).length;
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return bestScore >= 2 ? best : -1;
  };

  const aiMapColumns = async (aoa) => {
    const sample = aoa.slice(0, 12).map((r) => r.slice(0, 25).map((c) => String(c).slice(0, 60)));
    const text = await callAI(`These are the first rows of a messy spreadsheet of sales leads, as a JSON array of arrays (rows of cells). Title rows or section banners may appear above the real header row.\n\n${JSON.stringify(sample)}\n\nIdentify:\n1. "header_row": 0-based index of the row containing the real column headers\n2. "columns": 0-based column indexes for these fields, or null if absent: company, contact_name, country, city, email, phone, source, service, value, stage, niche, website, notes\n\nRespond ONLY with raw JSON in this exact shape, no markdown, no explanation:\n{"header_row": 0, "columns": {"company": null, "contact_name": null, "country": null, "city": null, "email": null, "phone": null, "source": null, "service": null, "value": null, "stage": null, "niche": null, "website": null, "notes": null}}`, 2000);
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  };

  const buildLeads = (aoa, headerIdx, cols) => {
    const existingKeys = new Set();
    leads.forEach((l) => {
      if (l.company) existingKeys.add("c:" + l.company.toLowerCase().trim());
      if (l.email) existingKeys.add("e:" + l.email.toLowerCase().trim());
    });
    const cell = (row, idx) => (idx === null || idx === undefined || idx < 0 ? "" : String(row[idx] ?? "").trim());
    return aoa.slice(headerIdx + 1)
      .map((r, i) => {
        const company = cell(r, cols.company);
        const email = cell(r, cols.email);
        const country = cell(r, cols.country);
        const city = cell(r, cols.city);
        const isDup = (company && existingKeys.has("c:" + company.toLowerCase())) || (email && existingKeys.has("e:" + email.toLowerCase()));
        return {
          id: Date.now() + i,
          name: cell(r, cols.name),
          company,
          country: city && country ? `${city}, ${country}` : country || city,
          email,
          phone: cell(r, cols.phone),
          source: cell(r, cols.source) || "Other",
          service: cell(r, cols.service) || "SEO",
          value: cell(r, cols.value).replace(/[^0-9.]/g, ""),
          stage: cols.stage !== null && cols.stage !== undefined ? normStage(cell(r, cols.stage)) : "New",
          category: cell(r, cols.category) || importNiche,
          website: cell(r, cols.website),
          notes: cell(r, cols.notes),
          createdAt: todayStr(),
          nextFollowUp: "",
          activities: [],
          isDup,
        };
      })
      .filter((r) => r.company || r.name);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (!aoa.length) {
        setImportError("The file looks empty.");
        return;
      }
      let parsed = [];
      const headerIdx = detectHeaderRow(aoa);
      if (headerIdx !== -1) {
        const headers = aoa[headerIdx].map((h) => String(h));
        const cols = {
          name: matchCol(headers, ["contactname", "contactperson", "personname", "person"]),
          company: matchCol(headers, ["companyname", "company", "organisation", "organization", "businessname", "firm"]),
          country: matchCol(headers, ["country", "market", "region"]),
          city: matchCol(headers, ["city", "state", "location"]),
          email: matchCol(headers, ["email", "mail"]),
          phone: matchCol(headers, ["phone", "whatsapp", "mobile", "contactno", "tel"]),
          source: matchCol(headers, ["leadsource", "source", "channel", "origin"]),
          service: matchCol(headers, ["service", "interest", "package"]),
          value: matchCol(headers, ["value", "amount", "budget", "deal", "price"]),
          stage: matchCol(headers, ["stage", "status", "pipeline"]),
          category: matchCol(headers, ["industry", "niche", "category", "sector"]),
          website: matchCol(headers, ["website", "url", "web"]),
          notes: matchCol(headers, ["note", "remark", "comment", "description"]),
        };
        if (cols.name === null) {
          const nameIdx = matchCol(headers, ["name"]);
          if (nameIdx !== null && nameIdx !== cols.company) cols.name = nameIdx;
        }
        if (cols.company !== null || cols.name !== null) {
          parsed = buildLeads(aoa, headerIdx, cols);
        }
      }
      if (!parsed.length) {
        setAiBusy(true);
        try {
          const ai = await aiMapColumns(aoa);
          const c = ai.columns || {};
          parsed = buildLeads(aoa, ai.header_row ?? 0, {
            name: c.contact_name, company: c.company, country: c.country, city: c.city,
            email: c.email, phone: c.phone, source: c.source, service: c.service,
            value: c.value, stage: c.stage, category: c.niche, website: c.website, notes: c.notes,
          });
        } catch (aiErr) {}
        setAiBusy(false);
      }
      if (!parsed.length) {
        setImportError("Couldn't detect lead data in this file, even with AI analysis. Make sure it has a column for company or contact name.");
        return;
      }
      setSkipDup(true);
      setImportPreview(parsed);
    } catch (err) {
      setAiBusy(false);
      setImportError("Couldn't read that file. Please upload a valid .xlsx, .xls, or .csv file.");
    }
    e.target.value = "";
  };

  const aiAutoTag = async () => {
    const untagged = leads.filter((l) => !l.category).slice(0, 60);
    if (!untagged.length) {
      setImportError("All your leads already have a niche — nothing to tag.");
      return;
    }
    setAiBusy(true);
    setImportError("");
    try {
      const list = untagged.map((l) => ({
        id: l.id,
        company: l.company || l.name,
        info: [l.notes, l.website, l.country].filter(Boolean).join(" | ").slice(0, 150),
      }));
      const text = await callAI(`You are a B2B lead classifier for a digital marketing agency. Classify each company into exactly one niche from this list: ${NICHES.join(", ")}.\nUse the company name and info to decide. For example, admission coaching or universities = Education, tour operators or travel agencies = Travel & Tourism.\n\nCompanies:\n${JSON.stringify(list)}\n\nRespond ONLY with a raw JSON array like [{"id": 123, "niche": "Education"}] covering every company — no markdown, no explanation.`, 2000);
      const arr = JSON.parse(text.replace(/```json|```/g, "").trim());
      const map = {};
      arr.forEach((a) => { if (a && a.id != null && a.niche) map[a.id] = String(a.niche); });
      const newLeads = leads.map((l) => (map[l.id] ? { ...l, category: map[l.id] } : l));
      setLeads(newLeads);
      persist(newLeads, clients);
    } catch (err) {
      setImportError("AI tagging failed: " + (err?.message || "unknown error"));
    }
    setAiBusy(false);
  };


  const confirmImport = () => {
    const toImport = importPreview.filter((r) => !(skipDup && r.isDup)).map(({ isDup, ...r }) => r);
    const newLeads = [...toImport, ...leads];
    setLeads(newLeads);
    persist(newLeads, clients);
    logAudit(`imported ${toImport.length} leads from Excel`);
    setImportPreview(null);
    setTab("leads");
  };

  const openLeads = leads.filter((l) => l.stage !== "Closed Won" && l.stage !== "Closed Lost");
  const pipelineValue = openLeads.reduce((s, l) => s + (parseFloat(l.value) || 0), 0);
  const mrr = clients.reduce((s, c) => s + (parseFloat(c.retainer) || 0), 0);
  const wonCount = leads.filter((l) => l.stage === "Closed Won").length;
  const closedCount = leads.filter((l) => l.stage === "Closed Won" || l.stage === "Closed Lost").length;
  const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

  const overdue = openLeads.filter((l) => l.nextFollowUp && l.nextFollowUp < todayStr());
  const dueToday = openLeads.filter((l) => l.nextFollowUp === todayStr());
  const proposals = leads.filter((l) => l.stage === "Proposal Sent" || l.stage === "Negotiating");

  const allPayments = clients.flatMap((c) => c.payments || []);
  const payByMonth = {};
  allPayments.forEach((p) => { payByMonth[p.month] = (payByMonth[p.month] || 0) + p.amount; });
  const months = Object.keys(payByMonth).sort().slice(-6);
  const maxPay = Math.max(...months.map((m) => payByMonth[m]), 1);

  const stageCounts = STAGES.map((s) => ({ stage: s, count: leads.filter((l) => l.stage === s).length }));
  const maxCount = Math.max(...stageCounts.map((s) => s.count), 1);
  const usedNiches = [...new Set(leads.map((l) => l.category).filter(Boolean))].sort();
  const usedOwners = [...new Set(leads.map((l) => l.owner).filter(Boolean))].sort();
  const teamMembers = [...new Set([...(leads.map((l) => l.owner)), ...(clients.map((c) => c.owner)), session?.user?.email].filter(Boolean))].sort();
  const ownerName = (email) => {
    if (!email) return "Unassigned";
    const p = profiles[email];
    if (p && p.name) return p.name;
    return email.split("@")[0];
  };
  const avatarOf = (email) => (email && profiles[email] && profiles[email].avatar) || "";

  const filteredLeads = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.company.toLowerCase().includes(q) || l.name.toLowerCase().includes(q) || (l.country || "").toLowerCase().includes(q) || (l.category || "").toLowerCase().includes(q);
    const matchStage = stageFilter === "All" || l.stage === stageFilter;
    const matchNiche = nicheFilter === "All" || l.category === nicheFilter;
    const matchOwner = ownerFilter === "All" || (ownerFilter === "Unassigned" ? !l.owner : l.owner === ownerFilter);
    return matchSearch && matchStage && matchNiche && matchOwner;
  });

  // ---- Deals / forecast data ----
  const openDeals = leads.filter((l) => l.stage !== "Closed Won" && l.stage !== "Closed Lost");
  const weightedForecast = openDeals.reduce((s, l) => s + (parseFloat(l.value) || 0) * (STAGE_PROB[l.stage] || 0), 0);
  const wonRevenue = leads.filter((l) => l.stage === "Closed Won").reduce((s, l) => s + (parseFloat(l.value) || 0), 0);
  const dealsByStage = STAGES.filter((s) => s !== "Closed Lost").map((stage) => {
    const ls = leads.filter((l) => l.stage === stage);
    return { stage, count: ls.length, value: ls.reduce((s, l) => s + (parseFloat(l.value) || 0), 0) };
  });
  const maxStageValue = Math.max(...dealsByStage.map((d) => d.value), 1);
  const dealsByOwner = usedOwners.map((o) => {
    const ls = openDeals.filter((l) => l.owner === o);
    return { owner: o, count: ls.length, value: ls.reduce((s, l) => s + (parseFloat(l.value) || 0), 0) };
  }).sort((a, b) => b.value - a.value);

  // ---- All tasks (client tasks + lead follow-ups) ----
  const allTasks = [];
  clients.forEach((c) => (c.tasks || []).forEach((t) => allTasks.push({ ...t, kind: "task", title: t.title || t.text, type: t.type || "Other", who: c.company || c.name, clientId: c.id })));
  generalTasks.forEach((t) => allTasks.push({ ...t, kind: "general", title: t.title || t.text, type: t.type || "Other", who: "General", clientId: "general" }));
  leads.forEach((l) => {
    if (l.nextFollowUp && l.stage !== "Closed Won" && l.stage !== "Closed Lost") {
      allTasks.push({ id: "f" + l.id, title: "Follow up", type: "Follow-up", due: l.nextFollowUp, done: false, kind: "followup", who: l.company || l.name, assignee: l.owner, leadId: l.id });
    }
  });
  const myEmail = session?.user?.email || "";
  const myRole = roles[myEmail] || (myEmail === SUPER_ADMIN ? "Executive" : "Member");
  const isExec = myRole === "Executive";
  const knownPeople = [...new Set([...teamMembers, ...checkins.map((c) => c.email), ...Object.keys(roles), ...Object.keys(profiles)].filter(Boolean))].sort();

  // ---- Leaderboard: per-user task performance ----
  const realTasks = allTasks.filter((t) => t.kind === "task" || t.kind === "general");
  const leaderboard = knownPeople.map((email) => {
    const mine = realTasks.filter((t) => t.assignee === email);
    const completed = mine.filter((t) => t.done).length;
    const overdue = mine.filter((t) => !t.done && t.due && t.due < todayStr()).length;
    const pending = mine.filter((t) => !t.done && (!t.due || t.due >= todayStr())).length;
    const signins = checkins.filter((c) => c.email === email).length;
    const total = mine.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { email, signins, total, completed, pending, overdue, rate };
  }).sort((a, b) => b.completed - a.completed || b.rate - a.rate);
  const teamSignins = checkins.length;
  const teamCompleted = realTasks.filter((t) => t.done).length;
  const teamOverdue = realTasks.filter((t) => !t.done && t.due && t.due < todayStr()).length;
  const teamPending = realTasks.filter((t) => !t.done && (!t.due || t.due >= todayStr())).length;

  // ---- Notification bell (current user) ----
  const myOpenTasks = realTasks.filter((t) => t.assignee === myEmail && !t.done);
  const myDueToday = myOpenTasks.filter((t) => t.due === todayStr());
  const myOverdue = myOpenTasks.filter((t) => t.due && t.due < todayStr());
  const myMentions = chatMessages.filter((m) => m.user_email !== myEmail && (m.text || "").toLowerCase().includes("@" + ownerName(myEmail).toLowerCase()));
  const newMentions = myMentions.filter((m) => !lastSeen || new Date(m.created_at) > new Date(lastSeen));
  const bellCount = newMentions.length + myDueToday.length + myOverdue.length;
  const openBell = () => {
    setBellOpen((o) => !o);
    const now = new Date().toISOString();
    setLastSeen(now);
    try { localStorage.setItem("nexify-bell-seen", now); } catch (e) {}
  };
  const visibleTasks = allTasks.filter((t) => {
    // Members only ever see tasks assigned to them
    if (!isExec && t.assignee !== myEmail) return false;
    if (taskTypeFilter === "All") return true;
    if (taskTypeFilter === "Mine") return t.assignee === myEmail;
    return t.type === taskTypeFilter;
  });
  const taskBucket = (due) => {
    if (!due) return "nodate";
    if (due < todayStr()) return "overdue";
    if (due === todayStr()) return "today";
    return "upcoming";
  };
  const openTasksAll = visibleTasks.filter((t) => !t.done);
  const tasksOverdue = openTasksAll.filter((t) => taskBucket(t.due) === "overdue").sort((a, b) => a.due.localeCompare(b.due));
  const tasksToday = openTasksAll.filter((t) => taskBucket(t.due) === "today");
  const tasksUpcoming = openTasksAll.filter((t) => taskBucket(t.due) === "upcoming").sort((a, b) => a.due.localeCompare(b.due));

  const filteredClients = clients.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.company.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.country || "").toLowerCase().includes(q) || (c.category || "").toLowerCase().includes(q);
  });

  const aiCheckWhatsApp = async () => {
    const withPhones = leads.filter((l) => l.phone && !l.waStatus).slice(0, 80);
    if (!withPhones.length) {
      setImportError("No unchecked phone numbers found.");
      return;
    }
    setAiBusy(true);
    setImportError("");
    try {
      const list = withPhones.map((l) => ({ id: l.id, phone: l.phone, country: l.country || "" }));
      const text = await callAI(`You are a phone number analyst. For each number, decide if it is a MOBILE number (likely to be on WhatsApp) or a LANDLINE/office number (unlikely to be on WhatsApp), using international numbering plans.\nExamples: UK +44 7x = mobile, +44 20 / 121 / 161 etc = landline. Malaysia +60 1x = mobile, +60 3 = landline. Bangladesh +880 1x = mobile, +880 2 = landline. Singapore +65 8/9 = mobile, +65 6 = landline. US/Canada numbers cannot be distinguished — mark those "likely".\n\nNumbers:\n${JSON.stringify(list)}\n\nRespond ONLY with a raw JSON array like [{"id": 123, "wa": "likely"}] where wa is "likely" or "unlikely", covering every number — no markdown, no explanation.`, 2000);
      const arr = JSON.parse(text.replace(/```json|```/g, "").trim());
      const map = {};
      arr.forEach((a) => { if (a && a.id != null && (a.wa === "likely" || a.wa === "unlikely")) map[a.id] = a.wa; });
      const newLeads = leads.map((l) => (map[l.id] ? { ...l, waStatus: map[l.id] } : l));
      setLeads(newLeads);
      persist(newLeads, clients);
      const unlikelyCount = Object.values(map).filter((v) => v === "unlikely").length;
      setToast(`Checked ${Object.keys(map).length} numbers — ${unlikelyCount} look like landlines (greyed out)`);
      setTimeout(() => setToast(""), 4000);
    } catch (err) {
      setImportError("AI WhatsApp check failed: " + (err?.message || "unknown error"));
    }
    setAiBusy(false);
  };

  const setWaStatus = (leadId, status) => {
    const newLeads = leads.map((l) => (l.id === leadId ? { ...l, waStatus: status } : l));
    setLeads(newLeads);
    persist(newLeads, clients);
  };

  const bulkTagNiche = () => {
    if (!bulkNiche) return;
    const ids = new Set(filteredLeads.map((l) => l.id));
    const newLeads = leads.map((l) => (ids.has(l.id) ? { ...l, category: bulkNiche } : l));
    setLeads(newLeads);
    persist(newLeads, clients);
    setBulkNiche("");
  };

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900";
  const labelCls = "block text-xs font-medium text-gray-500 mb-1";

  const FollowUpChip = ({ lead }) => {
    if (!lead.nextFollowUp || lead.stage === "Closed Won" || lead.stage === "Closed Lost") return null;
    const past = lead.nextFollowUp < todayStr();
    const today = lead.nextFollowUp === todayStr();
    const cls = past ? "bg-red-50 text-red-600 border-red-200" : today ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-50 text-gray-500 border-gray-200";
    return (
      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cls}`}>
        <CalendarClock size={11} />
        {past ? "Overdue " : today ? "Today" : ""}{!today ? lead.nextFollowUp : ""}
      </span>
    );
  };

  const ScoreBadge = ({ lead }) => {
    const s = leadScore(lead);
    if (!s) return null;
    return (
      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${s.cls}`}>
        {s.icon && <Flame size={11} />}{s.label}
      </span>
    );
  };

  const copyText = (text, msg) => {
    let ok = false;
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {}
    if (!ok && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
      ok = true;
    }
    setToast(ok ? msg : `Copy this manually: ${text}`);
    setTimeout(() => setToast(""), 3500);
  };

  const openExternal = (url, label) => {
    let w = null;
    try { w = window.open(url, "_blank", "noopener"); } catch (e) {}
    if (!w) copyText(url, `${label} link copied — paste it in your browser`);
  };

  const QuickActions = ({ item }) => (
    <span className="flex items-center gap-1">
      {item.phone && (item.waStatus === "unlikely" || item.waStatus === "no" ? (
        <button
          onClick={() => setToast(item.waStatus === "no" ? "You marked this number as not on WhatsApp" : "This looks like a landline — probably not on WhatsApp")}
          title="Probably not on WhatsApp"
          className="p-1.5 text-gray-300 hover:text-gray-400 rounded-md transition"
        >
          <MessageCircle size={15} />
        </button>
      ) : (
        <button
          onClick={() => openExternal(`https://wa.me/${waDigits(item.phone)}?text=${encodeURIComponent(`Hi${item.name ? " " + item.name : ""}, this is Parvez from Nexify Solution.`)}`, "WhatsApp")}
          title="Open WhatsApp (or copy link)"
          className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition"
        >
          <MessageCircle size={15} />
        </button>
      ))}
      {item.email && (
        <button
          onClick={() => copyText(item.email, `Email copied: ${item.email}`)}
          title="Copy email address"
          className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
        >
          <Mail size={15} />
        </button>
      )}
      {item.website && (
        <button
          onClick={() => openExternal(item.website.startsWith("http") ? item.website : `https://${item.website}`, "Website")}
          title="Open website (or copy link)"
          className="p-1.5 text-sky-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition"
        >
          <Link size={15} />
        </button>
      )}
    </span>
  );

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading Nexify CRM…</div>
      </div>
    );
  }

  function LoginScreen() {
    const [mode, setMode] = useState("login"); // "login" | "signup"
    const [email, setEmail] = useState("");
    const [pw, setPw] = useState("");
    const [err, setErr] = useState("");
    const [info, setInfo] = useState("");
    const [busy, setBusy] = useState(false);

    // OPTIONAL: restrict sign-ups to your company domain.
    // Leave as "" to allow any email. Set e.g. "nexifysolution.net" to lock it down.
    const ALLOWED_DOMAIN = "";

    const submit = async () => {
      setErr(""); setInfo(""); setBusy(true);
      if (mode === "signup") {
        if (pw.length < 6) { setErr("Password must be at least 6 characters."); setBusy(false); return; }
        if (ALLOWED_DOMAIN && !email.toLowerCase().endsWith("@" + ALLOWED_DOMAIN)) {
          setErr(`Only @${ALLOWED_DOMAIN} email addresses can register.`); setBusy(false); return;
        }
        const { data, error } = await supabase.auth.signUp({ email, password: pw });
        if (error) { setErr(error.message); }
        else if (data?.session) { /* logged in immediately */ }
        else { setInfo("Account created! Check your email to confirm, then sign in."); setMode("login"); }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) setErr(error.message);
      }
      setBusy(false);
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-sm shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-semibold">N</div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Nexify CRM</h1>
              <p className="text-xs text-gray-400">{mode === "signup" ? "Create your account" : "Team sign in"}</p>
            </div>
          </div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@nexifysolution.net" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
          <input value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} type="password" placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {err && <p className="text-xs text-red-600 mb-3">{err}</p>}
          {info && <p className="text-xs text-emerald-600 mb-3">{info}</p>}
          <button onClick={submit} disabled={busy} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-60">
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
          <div className="mt-4 text-center text-xs text-gray-500">
            {mode === "signup" ? (
              <button onClick={() => { setMode("login"); setErr(""); setInfo(""); }} className="hover:text-indigo-600">
                Already have an account? <span className="text-indigo-600 font-medium">Sign in</span>
              </button>
            ) : (
              <button onClick={() => { setMode("signup"); setErr(""); setInfo(""); }} className="hover:text-indigo-600">
                New here? <span className="text-indigo-600 font-medium">Create an account</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, exec: false },
    { id: "leads", label: "Leads", icon: Target, exec: true },
    { id: "clients", label: "Clients", icon: Briefcase, exec: true },
    { id: "deals", label: "Deals", icon: TrendingUp, exec: false },
    { id: "tasks", label: "Tasks", icon: ListChecks, exec: false },
    { id: "chat", label: "Chat", icon: MessageCircle, exec: false },
    { id: "reports", label: "Reports", icon: TrendingUp, exec: true },
    { id: "history", label: "History", icon: History, exec: true },
    { id: "team", label: "Team", icon: Users, exec: true },
  ].filter((t) => isExec || !t.exec);
  // Mobile bottom bar: 4 primary tabs + "More" sheet for the rest
  const mobilePrimaryIds = ["dashboard", "tasks", "chat", isExec ? "leads" : "deals"];
  const bottomPrimary = mobilePrimaryIds.map((id) => navItems.find((n) => n.id === id)).filter(Boolean);
  const bottomMore = navItems.filter((n) => !mobilePrimaryIds.includes(n.id));

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 md:gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="w-9 h-9 rounded-lg object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">N</div>
            )}
            {myEmail === SUPER_ADMIN && (
              <label className="text-xs text-gray-400 hover:text-indigo-600 cursor-pointer" title="Upload CRM logo">
                {uploadingLogo ? "…" : "✎"}
                <input type="file" accept="image/*" onChange={uploadLogo} className="hidden" disabled={uploadingLogo} />
              </label>
            )}
            <div>
              <h1 className="text-base font-semibold text-gray-900 leading-tight">Nexify CRM</h1>
              <p className="text-xs text-emerald-600 flex items-center gap-1"><Users size={11} /> Shared team workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {saveState === "saving" && <span className="text-xs text-gray-400 hidden sm:inline">Saving…</span>}
            {saveState === "saved" && <span className="text-xs text-emerald-600 hidden sm:inline">Saved</span>}
            {saveState === "error" && <span className="text-xs text-red-500">Save failed</span>}
            <button onClick={exportExcel} title="Export all data to Excel" className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
              <Download size={14} /> <span className="hidden md:inline">Export</span>
            </button>
            <div className="relative">
              <button onClick={openBell} title="Notifications" className="relative flex items-center px-2 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition">
                <Bell size={16} />
                {bellCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{bellCount}</span>}
              </button>
              {bellOpen && (
                <div className="absolute left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-gray-200 shadow-lg z-50 p-3" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                    <button onClick={() => setBellOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </div>
                  {bellCount === 0 && newMentions.length === 0 && myOverdue.length === 0 && myDueToday.length === 0 && (
                    <p className="text-xs text-gray-400 py-3 text-center">You're all caught up 🎉</p>
                  )}
                  {myOverdue.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-red-600 mb-1">Overdue ({myOverdue.length})</p>
                      {myOverdue.slice(0, 5).map((t) => (
                        <button key={t.id} onClick={() => { setTab("tasks"); setBellOpen(false); }} className="block w-full text-left text-xs text-gray-700 py-1 px-2 rounded hover:bg-gray-50">{t.title} <span className="text-gray-400">· {t.who} · {t.due}</span></button>
                      ))}
                    </div>
                  )}
                  {myDueToday.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-amber-600 mb-1">Due today ({myDueToday.length})</p>
                      {myDueToday.slice(0, 5).map((t) => (
                        <button key={t.id} onClick={() => { setTab("tasks"); setBellOpen(false); }} className="block w-full text-left text-xs text-gray-700 py-1 px-2 rounded hover:bg-gray-50">{t.title} <span className="text-gray-400">· {t.who}</span></button>
                      ))}
                    </div>
                  )}
                  {myMentions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-indigo-600 mb-1">Mentions</p>
                      {myMentions.slice(-5).reverse().map((m) => (
                        <button key={m.id} onClick={() => { setTab("chat"); setBellOpen(false); }} className="block w-full text-left text-xs text-gray-700 py-1 px-2 rounded hover:bg-gray-50"><b>{ownerName(m.user_email)}</b>: {(m.text || "").slice(0, 50)}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={openProfile} title="My profile" className="flex items-center gap-1.5 px-2 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
              {avatarOf(myEmail) ? <img src={avatarOf(myEmail)} alt="me" className="w-5 h-5 rounded-full object-cover" /> : <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">{ownerName(myEmail).slice(0, 1).toUpperCase()}</span>}
              <span className="hidden md:inline">{ownerName(myEmail)}</span>
            </button>
            <button onClick={() => supabase.auth.signOut()} title="Sign out" className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
              <LogOut size={14} />
            </button>
            <nav className="hidden md:flex bg-gray-100 rounded-lg p-1 flex-wrap">
              {navItems.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setSearch(""); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${tab === t.id ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <t.icon size={15} />
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-6 pb-24 md:pb-6">
        {tab === "dashboard" && (
          <div>
            {(myOverdue.length > 0 || myDueToday.length > 0) ? (
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3"><ListChecks size={15} className="text-indigo-600" /> My tasks — needs attention</h2>
                <div className="space-y-1.5">
                  {myOverdue.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                      <button onClick={() => toggleTask(t.clientId, t.id)} title="Mark complete" className="w-3.5 h-3.5 rounded border-2 border-gray-300 bg-white hover:border-emerald-500 shrink-0" />
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium shrink-0">Overdue</span>
                      <span className="text-gray-800 font-medium">{t.title}</span>
                      <span className="text-gray-400">· {t.who}</span>
                      <span className="ml-auto text-red-500 shrink-0">{t.due}</span>
                    </div>
                  ))}
                  {myDueToday.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                      <button onClick={() => toggleTask(t.clientId, t.id)} title="Mark complete" className="w-3.5 h-3.5 rounded border-2 border-gray-300 bg-white hover:border-emerald-500 shrink-0" />
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium shrink-0">Due today</span>
                      <span className="text-gray-800 font-medium">{t.title}</span>
                      <span className="text-gray-400">· {t.who}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setTab("tasks")} className="text-xs text-indigo-600 hover:underline mt-3">View all my tasks →</button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><ListChecks size={15} className="text-emerald-600" /> My tasks</h2>
                <p className="text-xs text-gray-400 mt-1">Nothing overdue or due today — you're on top of it. 🎉</p>
              </div>
            )}
            {(overdue.length > 0 || dueToday.length > 0) && isExec && (
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                {overdue.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2"><AlertTriangle size={15} /> Overdue follow-ups ({overdue.length})</h2>
                    <div className="space-y-1.5">
                      {overdue.slice(0, 5).map((l) => (
                        <div key={l.id} className="flex items-center justify-between text-xs">
                          <span className="text-red-800 font-medium">{l.company || l.name}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-red-500">{l.nextFollowUp}</span>
                            <QuickActions item={l} />
                          </span>
                        </div>
                      ))}
                      {overdue.length > 5 && <p className="text-xs text-red-400">+{overdue.length - 5} more</p>}
                    </div>
                  </div>
                )}
                {dueToday.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-amber-700 flex items-center gap-2 mb-2"><Clock size={15} /> Due today ({dueToday.length})</h2>
                    <div className="space-y-1.5">
                      {dueToday.slice(0, 5).map((l) => (
                        <div key={l.id} className="flex items-center justify-between text-xs">
                          <span className="text-amber-800 font-medium">{l.company || l.name}</span>
                          <QuickActions item={l} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Target size={14} /> Open leads</div>
                <div className="text-2xl font-semibold text-gray-900">{openLeads.length}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><TrendingUp size={14} /> Pipeline value</div>
                <div className="text-2xl font-semibold text-gray-900">{fmt(pipelineValue)}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Briefcase size={14} /> Active clients</div>
                <div className="text-2xl font-semibold text-gray-900">{clients.length}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Users size={14} /> Monthly retainers</div>
                <div className="text-2xl font-semibold text-gray-900">{fmt(mrr)}</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Pipeline by stage</h2>
                <div className="space-y-3">
                  {stageCounts.map((s) => (
                    <div key={s.stage} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-28 shrink-0">{s.stage}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.stage === "Closed Won" ? "bg-emerald-500" : s.stage === "Closed Lost" ? "bg-gray-300" : "bg-indigo-500"}`}
                          style={{ width: `${(s.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-6 text-right">{s.count}</span>
                    </div>
                  ))}
                </div>
                {leads.length === 0 && <p className="text-xs text-gray-400 mt-3">No leads yet — add your first lead to see the pipeline.</p>}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><Banknote size={15} className="text-emerald-600" /> Revenue (last 6 months)</h2>
                {months.length === 0 ? (
                  <p className="text-xs text-gray-400">No payments logged yet. Open a client card and add payments to track revenue.</p>
                ) : (
                  <div className="space-y-3">
                    {months.map((m) => (
                      <div key={m} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-16 shrink-0">{m}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(payByMonth[m] / maxPay) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-20 text-right">{fmt(payByMonth[m])}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-100 flex justify-between text-xs">
                      <span className="text-gray-500">Total collected</span>
                      <span className="font-semibold text-gray-900">{fmt(allPayments.reduce((s, p) => s + p.amount, 0))}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileText size={15} className="text-amber-600" /> Proposal tracker</h2>
                {proposals.length === 0 ? (
                  <p className="text-xs text-gray-400">No proposals out right now. Move a lead to "Proposal Sent" and it appears here.</p>
                ) : (
                  <div className="space-y-2">
                    {proposals.map((l) => {
                      const days = daysSince(l.proposalDate || l.createdAt) ?? 0;
                      return (
                        <div key={l.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
                          <div>
                            <span className="font-medium text-gray-900">{l.company || l.name}</span>
                            <span className="text-gray-400 ml-2">{l.value ? fmt(l.value) : ""}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full ${days > 7 ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-500"}`}>
                            {days === 0 ? "Sent today" : `Waiting ${days}d`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Quick stats</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Win rate</span>
                    <span className="text-sm font-semibold text-gray-900">{closedCount > 0 ? `${winRate}%` : "—"}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Hot leads</span>
                    <span className="text-sm font-semibold text-red-600">{openLeads.filter((l) => leadScore(l)?.label === "Hot").length}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Deals won</span>
                    <span className="text-sm font-semibold text-emerald-600">{wonCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Avg deal size (open)</span>
                    <span className="text-sm font-semibold text-gray-900">{openLeads.length > 0 ? fmt(pipelineValue / openLeads.length) : "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            {usedNiches.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Leads by niche</h2>
                <div className="flex flex-wrap gap-2">
                  {usedNiches.map((n) => {
                    const count = leads.filter((l) => l.category === n).length;
                    return (
                      <button key={n} onClick={() => { setTab("leads"); setNicheFilter(n); setStageFilter("All"); setSearch(""); }} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100 transition">
                        {n}
                        <span className="bg-white rounded-full px-1.5 py-0.5 text-violet-600">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "leads" && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="relative flex-1" style={{ minWidth: 190 }}>
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads…" className={inputCls + " pl-9"} />
              </div>
              <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option>All</option>
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="All">All niches</option>
                {usedNiches.map((n) => <option key={n}>{n}</option>)}
              </select>
              <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="All">All owners</option>
                {usedOwners.map((o) => <option key={o} value={o}>{ownerName(o)}</option>)}
                <option value="Unassigned">Unassigned</option>
              </select>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button onClick={() => setView("list")} title="List view" className={`p-1.5 rounded-md transition ${view === "list" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-400"}`}><List size={15} /></button>
                <button onClick={() => setView("kanban")} title="Kanban board" className={`p-1.5 rounded-md transition ${view === "kanban" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-400"}`}><Columns size={15} /></button>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              <select value={importNiche} onChange={(e) => setImportNiche(e.target.value)} title="Imported leads will be tagged with this niche" className="px-3 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Tag import as…</option>
                {NICHES.map((n) => <option key={n}>{n}</option>)}
              </select>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-4 py-2 border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-lg text-sm font-medium hover:bg-indigo-100 transition">
                <Upload size={15} /> Import Excel
              </button>
              <button onClick={() => openAdd("lead")} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
                <Plus size={15} /> Add lead
              </button>
            </div>
            {aiBusy && (
              <div className="mb-4 px-4 py-3 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-700 flex items-center gap-2">
                <Sparkles size={15} className="animate-pulse" />
                AI is analyzing… this takes a few seconds.
              </div>
            )}
            {importError && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
                <span>{importError}</span>
                <button onClick={() => setImportError("")} className="text-red-400 hover:text-red-600"><X size={15} /></button>
              </div>
            )}
            {filteredLeads.length > 0 && (
              <div className="mb-4 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-lg flex flex-wrap items-center gap-2 text-xs text-violet-700">
                <span className="font-medium">Tag all {filteredLeads.length} shown lead{filteredLeads.length !== 1 ? "s" : ""} as:</span>
                <input list="niche-list-bulk" value={bulkNiche} onChange={(e) => setBulkNiche(e.target.value)} placeholder="e.g. Education" className="px-2.5 py-1 border border-violet-200 rounded-md bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                <datalist id="niche-list-bulk">
                  {NICHES.map((n) => <option key={n} value={n} />)}
                </datalist>
                <button onClick={bulkTagNiche} disabled={!bulkNiche} className="px-3 py-1 bg-violet-600 text-white rounded-md font-medium hover:bg-violet-700 transition disabled:opacity-40 disabled:cursor-not-allowed">Apply</button>
                <span className="text-violet-300">|</span>
                <button onClick={aiAutoTag} disabled={aiBusy} className="flex items-center gap-1.5 px-3 py-1 bg-violet-600 text-white rounded-md font-medium hover:bg-violet-700 transition disabled:opacity-60">
                  <Sparkles size={12} />
                  {aiBusy ? "AI is working…" : "AI auto-tag untagged leads"}
                </button>
                <button onClick={aiCheckWhatsApp} disabled={aiBusy} className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-md font-medium hover:bg-emerald-700 transition disabled:opacity-60">
                  <MessageCircle size={12} />
                  AI check WhatsApp numbers
                </button>
              </div>
            )}

            {filteredLeads.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                <Target size={28} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 mb-1">{leads.length === 0 ? "No leads yet" : "No leads match your filters"}</p>
                <p className="text-xs text-gray-400">{leads.length === 0 ? "Add your first lead or import an Excel file." : "Try a different search or filter."}</p>
              </div>
            ) : view === "kanban" ? (
              <div className="flex gap-3 overflow-x-auto pb-4">
                {STAGES.map((stage) => {
                  const stageLeads = filteredLeads.filter((l) => l.stage === stage);
                  return (
                    <div
                      key={stage}
                      className={`flex-1 bg-gray-100 rounded-xl p-2 ${dragId ? "outline-dashed outline-1 outline-indigo-300" : ""}`}
                      style={{ minWidth: 175 }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { if (dragId) updateStage(dragId, stage); setDragId(null); }}
                    >
                      <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                        <span className="text-xs font-semibold text-gray-600">{stage}</span>
                        <span className="text-xs text-gray-400">{stageLeads.length}</span>
                      </div>
                      <div className="space-y-2">
                        {stageLeads.map((l) => (
                          <div
                            key={l.id}
                            draggable
                            onDragStart={() => setDragId(l.id)}
                            onDragEnd={() => setDragId(null)}
                            className="bg-white rounded-lg border border-gray-200 p-2.5 cursor-grab active:cursor-grabbing hover:border-indigo-300 transition"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <p className="text-xs font-semibold text-gray-900 leading-snug">{l.company || l.name}</p>
                              <ScoreBadge lead={l} />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{l.value ? fmt(l.value) : l.service}</p>
                            <div className="flex items-center justify-between mt-1.5">
                              <FollowUpChip lead={l} />
                              <button onClick={() => openEdit("lead", l)} className="text-gray-300 hover:text-indigo-600"><Pencil size={12} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLeads.map((l) => (
                  <div key={l.id} className="bg-white rounded-xl border border-gray-200 hover:border-indigo-200 transition">
                    <div className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-gray-900">{l.company || l.name}</h3>
                            <ScoreBadge lead={l} />
                            {l.category && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">{l.category}</span>}
                            {l.country && <span className="flex items-center gap-1 text-xs text-gray-400"><Globe size={11} />{l.country}</span>}
                            <FollowUpChip lead={l} />
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200" title={l.owner || "Unassigned"}><Users size={10} />{ownerName(l.owner)}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {l.name && l.company ? `${l.name} · ` : ""}{l.service} · {l.source}{l.value ? ` · ${fmt(l.value)}` : ""}
                          </p>
                          {(l.email || l.phone) && (
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                              {l.email && <span className="flex items-center gap-1"><Mail size={11} />{l.email}</span>}
                              {l.phone && <span className="flex items-center gap-1"><Phone size={11} />{l.phone}</span>}
                            </p>
                          )}
                          {l.notes && <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 rounded-md px-2 py-1 inline-block">{l.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <QuickActions item={l} />
                          <div className="relative">
                            <select
                              value={l.stage}
                              onChange={(e) => updateStage(l.id, e.target.value)}
                              className={`appearance-none text-xs font-medium pl-2.5 pr-7 py-1.5 rounded-full border cursor-pointer focus:outline-none ${STAGE_COLORS[l.stage]}`}
                            >
                              {STAGES.map((s) => <option key={s}>{s}</option>)}
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                          </div>
                          {l.stage !== "Closed Won" && l.stage !== "Closed Lost" && (
                            <button onClick={() => convertToClient(l)} title="Convert to client" className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition font-medium">
                              Won → Client
                            </button>
                          )}
                          <button onClick={() => openEdit("lead", l)} className="p-1.5 text-gray-400 hover:text-indigo-600 transition"><Pencil size={15} /></button>
                          <button onClick={() => deleteItem("lead", l.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition"><Trash2 size={15} /></button>
                          <button onClick={() => { setExpandedLead(expandedLead === l.id ? null : l.id); setActivityText(""); }} title="Activity log" className="p-1.5 text-gray-400 hover:text-indigo-600 transition">
                            {expandedLead === l.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    {expandedLead === l.id && (
                      <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl p-4">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <span className="text-xs font-medium text-gray-500 flex items-center gap-1"><CalendarClock size={13} /> Next follow-up:</span>
                          <input type="date" value={l.nextFollowUp || ""} onChange={(e) => setFollowUp(l.id, e.target.value)} className="px-2 py-1 border border-gray-200 rounded-md text-xs bg-white" />
                          {l.nextFollowUp && <button onClick={() => setFollowUp(l.id, "")} className="text-xs text-gray-400 hover:text-red-500">Clear</button>}
                          {l.phone && (
                            <span className="flex items-center gap-1.5 ml-auto">
                              <span className="text-xs font-medium text-gray-500 flex items-center gap-1"><MessageCircle size={13} /> On WhatsApp?</span>
                              <button onClick={() => setWaStatus(l.id, "yes")} className={`text-xs px-2 py-0.5 rounded-md border transition ${l.waStatus === "yes" || l.waStatus === "likely" ? "bg-emerald-100 border-emerald-300 text-emerald-700 font-medium" : "bg-white border-gray-200 text-gray-500 hover:border-emerald-300"}`}>Yes</button>
                              <button onClick={() => setWaStatus(l.id, "no")} className={`text-xs px-2 py-0.5 rounded-md border transition ${l.waStatus === "no" || l.waStatus === "unlikely" ? "bg-gray-200 border-gray-300 text-gray-700 font-medium" : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"}`}>No</button>
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 mb-3">
                          <input
                            value={activityText}
                            onChange={(e) => setActivityText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addActivity(l.id)}
                            placeholder="Log an activity… e.g. Sent WhatsApp follow-up"
                            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button onClick={() => addActivity(l.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition">Log</button>
                        </div>
                        {(l.activities || []).length === 0 ? (
                          <p className="text-xs text-gray-400">No activity yet. Every touchpoint you log appears here.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {(l.activities || []).map((a) => (
                              <div key={a.id} className="flex items-start gap-2 text-xs">
                                <span className="text-gray-400 shrink-0 w-20">{a.date}</span>
                                <span className="text-gray-700">{a.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "clients" && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="relative flex-1" style={{ minWidth: 190 }}>
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…" className={inputCls + " pl-9"} />
              </div>
              <button onClick={() => openAdd("client")} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
                <Plus size={15} /> Add client
              </button>
            </div>

            {filteredClients.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                <Briefcase size={28} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 mb-1">{clients.length === 0 ? "No clients yet" : "No clients match your search"}</p>
                <p className="text-xs text-gray-400">{clients.length === 0 ? "Add a client manually, or convert a won lead." : "Try a different search."}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3 items-start">
                {filteredClients.map((c) => {
                  const totalPaid = (c.payments || []).reduce((s, p) => s + p.amount, 0);
                  const openTasks = (c.tasks || []).filter((t) => !t.done).length;
                  return (
                    <div key={c.id} className="bg-white rounded-xl border border-gray-200 hover:border-indigo-200 transition">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0">
                              {(c.company || c.name || "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">{c.company || c.name}</h3>
                              <p className="text-xs text-gray-500 truncate">{c.name && c.company ? c.name : c.country || ""}{c.country && c.name && c.company ? ` · ${c.country}` : ""}{c.category ? ` · ${c.category}` : ""}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center">
                            <QuickActions item={c} />
                            <button onClick={() => openEdit("client", c)} className="p-1.5 text-gray-400 hover:text-indigo-600 transition"><Pencil size={14} /></button>
                            <button onClick={() => deleteItem("client", c.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                            <button onClick={() => { setExpandedClient(expandedClient === c.id ? null : c.id); setTaskText(""); setPayAmount(""); }} className="p-1.5 text-gray-400 hover:text-indigo-600 transition">
                              {expandedClient === c.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-400 block">Retainer</span>
                            <span className="font-medium text-gray-900">{c.retainer ? `${fmt(c.retainer)}/mo` : "—"}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Total collected</span>
                            <span className="font-medium text-emerald-700">{totalPaid > 0 ? fmt(totalPaid) : "—"}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Services</span>
                            <span className="font-medium text-gray-900">{c.services || "—"}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Open tasks</span>
                            <span className="font-medium text-gray-900">{openTasks > 0 ? openTasks : "—"}</span>
                          </div>
                        </div>
                        {c.notes && <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-md px-2 py-1.5">{c.notes}</p>}
                      </div>
                      {expandedClient === c.id && (
                        <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl p-4 space-y-4">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-2"><ListChecks size={13} /> Tasks</h4>
                            <div className="flex gap-2 mb-2">
                              <input value={taskText} onChange={(e) => setTaskText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask(c.id)} placeholder="New task…" className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                              <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
                              <button onClick={() => addTask(c.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition">Add</button>
                            </div>
                            {(c.tasks || []).length === 0 ? (
                              <p className="text-xs text-gray-400">No tasks yet.</p>
                            ) : (
                              <div className="space-y-1">
                                {(c.tasks || []).map((t) => {
                                  const late = t.due && !t.done && t.due < todayStr();
                                  return (
                                    <div key={t.id} className="flex items-center gap-2 text-xs group">
                                      <button onClick={() => toggleTask(c.id, t.id)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${t.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 bg-white hover:border-indigo-400"}`}>
                                        {t.done && <Check size={11} />}
                                      </button>
                                      <span className={t.done ? "line-through text-gray-400" : "text-gray-700"}>{t.title || t.text}</span>
                                      {t.due && <span className={`ml-auto ${late ? "text-red-500 font-medium" : "text-gray-400"}`}>{t.due}</span>}
                                      <button onClick={() => deleteTask(c.id, t.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><X size={12} /></button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-2"><Banknote size={13} /> Payments</h4>
                            <div className="flex gap-2 mb-2">
                              <input type="month" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
                              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPayment(c.id)} placeholder="Amount (RM)" className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                              <button onClick={() => addPayment(c.id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition">Log</button>
                            </div>
                            {(c.payments || []).length === 0 ? (
                              <p className="text-xs text-gray-400">No payments logged yet.</p>
                            ) : (
                              <div className="space-y-1">
                                {[...(c.payments || [])].sort((a, b) => b.month.localeCompare(a.month)).map((p) => (
                                  <div key={p.id} className="flex items-center gap-2 text-xs group">
                                    <span className="text-gray-500 w-16">{p.month}</span>
                                    <span className="font-medium text-gray-900">{fmt(p.amount)}</span>
                                    <button onClick={() => deletePayment(c.id, p.id)} className="ml-auto text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><X size={12} /></button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {tab === "deals" && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Target size={14} /> Open deals</div>
                <div className="text-2xl font-semibold text-gray-900">{openDeals.length}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><TrendingUp size={14} /> Pipeline value</div>
                <div className="text-2xl font-semibold text-gray-900">{fmt(openDeals.reduce((s, l) => s + (parseFloat(l.value) || 0), 0))}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Sparkles size={14} /> Weighted forecast</div>
                <div className="text-2xl font-semibold text-indigo-700">{fmt(weightedForecast)}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Banknote size={14} /> Won revenue</div>
                <div className="text-2xl font-semibold text-emerald-600">{fmt(wonRevenue)}</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">Pipeline value by stage</h2>
                <p className="text-xs text-gray-400 mb-4">How much money sits at each stage right now.</p>
                <div className="space-y-3">
                  {dealsByStage.map((d) => (
                    <div key={d.stage} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-28 shrink-0">{d.stage}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div className={`h-full rounded-full ${d.stage === "Closed Won" ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${(d.value / maxStageValue) * 100}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-20 text-right">{fmt(d.value)}</span>
                      <span className="text-xs text-gray-400 w-6 text-right">{d.count}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">Weighted forecast applies a win-chance to each stage (New 10% → Negotiating 75%), so you get a realistic revenue estimate, not just the raw total.</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">Pipeline by owner</h2>
                <p className="text-xs text-gray-400 mb-4">Who's carrying how much open pipeline.</p>
                {dealsByOwner.length === 0 ? (
                  <p className="text-xs text-gray-400">No owned deals yet. Assign owners on the Leads tab.</p>
                ) : (
                  <div className="space-y-2">
                    {dealsByOwner.map((o) => (
                      <div key={o.owner} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                        <span className="flex items-center gap-2 text-gray-700"><span className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-semibold">{ownerName(o.owner).slice(0, 2).toUpperCase()}</span>{ownerName(o.owner)}</span>
                        <span className="text-right">
                          <span className="font-semibold text-gray-900">{fmt(o.value)}</span>
                          <span className="text-xs text-gray-400 ml-2">{o.count} deal{o.count !== 1 ? "s" : ""}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "tasks" && (
          <div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2"><Check size={15} className="text-emerald-600" /> Daily check-in</h2>
              <p className="text-xs text-gray-400 mb-3">Logging in once a day automatically checks you in. Here's today ({todayStr()}):</p>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...teamMembers, ...checkins.map((c) => c.email)])].filter(Boolean).map((m) => {
                  const inToday = checkins.some((c) => c.email === m && c.date === todayStr());
                  return (
                    <span key={m} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${inToday ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                      {inToday ? <Check size={11} /> : <Clock size={11} />}
                      {ownerName(m)}{inToday ? "" : " — not yet"}
                    </span>
                  );
                })}
                {checkins.length === 0 && <span className="text-xs text-gray-400">No check-ins recorded yet.</span>}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 mb-5">
              <div className="flex flex-wrap gap-1.5 order-2 sm:order-1">
                {["All", "Mine", ...taskTypes].map((f) => (
                  <button key={f} onClick={() => setTaskTypeFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${taskTypeFilter === f ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{f}</button>
                ))}
              </div>
              <button onClick={openTaskModal} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition order-1 sm:order-2 w-full sm:w-auto">
                <Plus size={15} /> Create task
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-white rounded-xl border border-red-200 p-4">
                <div className="text-xs text-red-500 mb-1">Overdue</div>
                <div className="text-2xl font-semibold text-red-600">{tasksOverdue.length}</div>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 p-4">
                <div className="text-xs text-amber-600 mb-1">Due today</div>
                <div className="text-2xl font-semibold text-amber-600">{tasksToday.length}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-400 mb-1">Upcoming</div>
                <div className="text-2xl font-semibold text-gray-900">{tasksUpcoming.length}</div>
              </div>
            </div>

            {[
              { label: "Overdue", items: tasksOverdue, color: "text-red-600" },
              { label: "Due today", items: tasksToday, color: "text-amber-600" },
              { label: "Upcoming", items: tasksUpcoming, color: "text-gray-700" },
            ].map((group) => (
              <div key={group.label} className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                <h2 className={`text-sm font-semibold mb-3 ${group.color}`}>{group.label} ({group.items.length})</h2>
                {group.items.length === 0 ? (
                  <p className="text-xs text-gray-400">Nothing here.</p>
                ) : (
                  <div className="space-y-2">
                    {group.items.map((t) => (
                      <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm py-2 border-b border-gray-50 last:border-0">
                        {t.kind === "followup" ? (
                          <span className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><CalendarClock size={10} className="text-amber-600" /></span>
                        ) : (
                          <button onClick={() => toggleTask(t.clientId, t.id)} title="Mark complete (asks for proof)" className="w-4 h-4 rounded border-2 border-gray-300 bg-white hover:border-emerald-500 hover:bg-emerald-50 shrink-0" />
                        )}
                        <span className="text-xs px-1.5 py-0.5 rounded border bg-gray-50 text-gray-500 border-gray-200 shrink-0">{t.type}</span>
                        <span className="text-gray-800 font-medium">{t.title}</span>
                        <span className="text-xs text-gray-400">· {t.who}</span>
                        {t.priority && <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${PRIORITY_COLORS[t.priority] || ""}`}>{t.priority}</span>}
                        {t.assignee && <span className="text-xs text-gray-400 flex items-center gap-1"><Users size={10} />{ownerName(t.assignee)}</span>}
                        <span className="ml-auto text-xs text-gray-400 shrink-0">{t.due}{t.dueTime ? ` ${t.dueTime}` : ""}</span>
                        {isExec && t.kind !== "followup" && (
                          <span className="flex items-center gap-1 shrink-0">
                            <button onClick={() => openEditTask(t)} title="Edit task" className="p-1 text-gray-300 hover:text-indigo-600 transition"><Pencil size={13} /></button>
                            <button onClick={() => deleteAnyTask(t.clientId, t.id)} title="Delete task" className="p-1 text-gray-300 hover:text-red-500 transition"><Trash2 size={13} /></button>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {visibleTasks.filter((t) => t.done).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                <h2 className="text-sm font-semibold text-emerald-600 mb-3 flex items-center gap-2"><Check size={15} /> Completed (with proof)</h2>
                <div className="space-y-2">
                  {visibleTasks.filter((t) => t.done).slice(0, 30).map((t) => (
                    <div key={t.id} className="flex items-start gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
                      <button onClick={() => toggleTask(t.clientId, t.id)} title="Reopen task" className="w-4 h-4 rounded bg-emerald-500 border border-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5"><Check size={11} /></button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 rounded border bg-gray-50 text-gray-500 border-gray-200">{t.type}</span>
                          <span className="text-gray-500 line-through">{t.title}</span>
                          <span className="text-xs text-gray-400">· {t.who}</span>
                        </div>
                        {(t.proofNote || t.proofLink || t.proofImage) && (
                          <div className="mt-1 text-xs bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1 inline-block">
                            <span className="text-emerald-700 font-medium">Proof: </span>
                            {t.proofNote && <span className="text-gray-700">{t.proofNote} </span>}
                            {t.proofLink && <button onClick={() => openExternal(t.proofLink.startsWith("http") ? t.proofLink : `https://${t.proofLink}`, "Proof")} className="text-indigo-600 underline">view link</button>}
                            {t.completedBy && <span className="text-gray-400"> — {ownerName(t.completedBy)}</span>}
                            {t.proofImage && <div className="mt-1"><img src={t.proofImage} alt="proof" className="h-20 rounded-lg border border-gray-200 cursor-pointer" onClick={() => openExternal(t.proofImage, "Proof image")} /></div>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400">Create tasks tied to a client, assign them to a teammate, and capture proof of work on completion. Follow-ups come from lead follow-up dates.</p>
          </div>
        )}

        {tab === "chat" && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ height: "70vh" }}>
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><MessageCircle size={15} className="text-indigo-600" /> Team chat</h2>
                <p className="text-xs text-gray-400">Type @ to mention a teammate. Messages refresh automatically.</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center mt-8">No messages yet. Say hello 👋</p>
                ) : (
                  chatMessages.map((m) => {
                    const mine = m.user_email === myEmail;
                    const mentionsMe = (m.text || "").toLowerCase().includes("@" + ownerName(myEmail).toLowerCase());
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? "bg-indigo-600 text-white" : mentionsMe ? "bg-amber-50 border border-amber-200" : "bg-gray-100"}`}>
                          {!mine && <div className="text-xs font-semibold text-indigo-700 mb-0.5">{ownerName(m.user_email)}</div>}
                          <div className={`text-sm whitespace-pre-wrap break-words ${mine ? "text-white" : "text-gray-800"}`}>
                            {(m.text || "").split(/(@\w+)/g).map((part, i) =>
                              part.startsWith("@") ? <span key={i} className={mine ? "font-semibold underline" : "font-semibold text-indigo-600"}>{part}</span> : part
                            )}
                          </div>
                          <div className={`text-xs mt-0.5 ${mine ? "text-indigo-200" : "text-gray-400"}`}>{new Date(m.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="border-t border-gray-100 p-3">
                <div className="flex flex-wrap gap-1 mb-2">
                  {knownPeople.filter((p) => p !== myEmail).map((p) => (
                    <button key={p} onClick={() => setChatText((t) => `${t}@${ownerName(p)} `)} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition">@{ownerName(p)}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={chatText} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Type a message…" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button onClick={sendChat} disabled={!chatText.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">Send</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "team" && isExec && (
          <div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2"><Users size={15} /> Team & roles</h2>
              <p className="text-xs text-gray-400 mb-4">Executives see everything. Members can only use Tasks and Chat. People appear here once they've logged in or been assigned a lead.</p>
              {knownPeople.length === 0 ? (
                <p className="text-xs text-gray-400">No team members yet.</p>
              ) : (
                <div className="space-y-2">
                  {knownPeople.map((p) => {
                    const r = roles[p] || (p === SUPER_ADMIN ? "Executive" : "Member");
                    const locked = p === SUPER_ADMIN;
                    return (
                      <div key={p} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <span className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-semibold">{ownerName(p).slice(0, 2).toUpperCase()}</span>
                          {ownerName(p)} <span className="text-xs text-gray-400">{p}</span>
                          {locked && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">admin</span>}
                        </span>
                        <select disabled={locked} value={r} onChange={(e) => setUserRole(p, e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60">
                          <option>Executive</option>
                          <option>Member</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2"><ListChecks size={15} /> Task types</h2>
              <p className="text-xs text-gray-400 mb-3">Add or remove the task types your team can choose when creating tasks.</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {taskTypes.map((t) => (
                  <span key={t} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                    {t}
                    {taskTypes.length > 1 && <button onClick={() => removeTaskType(t)} className="text-gray-400 hover:text-red-500"><X size={12} /></button>}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newTypeText} onChange={(e) => setNewTypeText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTaskType()} placeholder="New type… e.g. WhatsApp" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={addTaskType} disabled={!newTypeText.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">Add type</button>
              </div>
            </div>
          </div>
        )}

        {tab === "reports" && isExec && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-400">Team performance & task reminders</p>
              <button onClick={sendRemindersNow} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
                <Mail size={15} /> Send reminders now
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Check size={14} /> Total sign-ins</div>
                <div className="text-2xl font-semibold text-gray-900">{teamSignins}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><ListChecks size={14} /> Tasks completed</div>
                <div className="text-2xl font-semibold text-emerald-600">{teamCompleted}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Clock size={14} /> Pending</div>
                <div className="text-2xl font-semibold text-gray-900">{teamPending}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><AlertTriangle size={14} /> Missed (overdue)</div>
                <div className="text-2xl font-semibold text-red-600">{teamOverdue}</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2"><TrendingUp size={15} className="text-indigo-600" /> Performance graph</h2>
              <p className="text-xs text-gray-400 mb-4">Each person's tasks: <span className="text-emerald-600 font-medium">completed</span> · <span className="text-amber-600 font-medium">pending</span> · <span className="text-red-600 font-medium">overdue</span>.</p>
              {leaderboard.filter((u) => u.total > 0).length === 0 ? (
                <p className="text-xs text-gray-400">No tasks assigned yet.</p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.filter((u) => u.total > 0).map((u) => (
                    <div key={u.email} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-24 shrink-0 truncate">{ownerName(u.email)}</span>
                      <div className="flex-1 flex h-3 rounded-full overflow-hidden bg-gray-100">
                        {u.completed > 0 && <div className="bg-emerald-500" style={{ width: `${(u.completed / u.total) * 100}%` }} title={`${u.completed} completed`} />}
                        {u.pending > 0 && <div className="bg-amber-400" style={{ width: `${(u.pending / u.total) * 100}%` }} title={`${u.pending} pending`} />}
                        {u.overdue > 0 && <div className="bg-red-500" style={{ width: `${(u.overdue / u.total) * 100}%` }} title={`${u.overdue} overdue`} />}
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-10 text-right">{u.rate}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><Users size={15} /> Leaderboard</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 text-left border-b border-gray-100">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Member</th>
                      <th className="py-2 pr-3 text-center">Sign-ins</th>
                      <th className="py-2 pr-3 text-center">Total</th>
                      <th className="py-2 pr-3 text-center">Completed</th>
                      <th className="py-2 pr-3 text-center">Pending</th>
                      <th className="py-2 pr-3 text-center">Missed</th>
                      <th className="py-2 pr-3 text-center">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((u, i) => (
                      <tr key={u.email} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-3 text-gray-400">{i + 1}</td>
                        <td className="py-2 pr-3">
                          <span className="flex items-center gap-2">
                            {avatarOf(u.email) ? <img src={avatarOf(u.email)} alt="" className="w-6 h-6 rounded-full object-cover" /> : <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-semibold">{ownerName(u.email).slice(0, 1).toUpperCase()}</span>}
                            <span className="text-gray-800">{ownerName(u.email)}</span>
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-center text-gray-700">{u.signins}</td>
                        <td className="py-2 pr-3 text-center text-gray-700">{u.total}</td>
                        <td className="py-2 pr-3 text-center text-emerald-600 font-medium">{u.completed}</td>
                        <td className="py-2 pr-3 text-center text-gray-700">{u.pending}</td>
                        <td className="py-2 pr-3 text-center text-red-600 font-medium">{u.overdue}</td>
                        <td className="py-2 pr-3 text-center font-semibold text-gray-900">{u.total > 0 ? `${u.rate}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2"><History size={15} /> Change history</h2>
              <p className="text-xs text-gray-400 mb-4">Every change made by your team, newest first.</p>
              {auditLog.length === 0 ? (
                <p className="text-xs text-gray-400">No activity recorded yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                  {auditLog.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 text-xs py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-gray-400 shrink-0 w-32">{new Date(a.created_at).toLocaleString()}</span>
                      <span className="font-medium text-indigo-700 shrink-0">{(a.user_email || "?").split("@")[0]}</span>
                      <span className="text-gray-700">{a.action}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-40" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {bottomPrimary.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch(""); setMoreOpen(false); }} className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs ${tab === t.id ? "text-indigo-600" : "text-gray-400"}`}>
            <t.icon size={20} />
            <span className="text-[10px]">{t.label}</span>
          </button>
        ))}
        {bottomMore.length > 0 && (
          <button onClick={() => setMoreOpen((o) => !o)} className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs ${moreOpen || bottomMore.some((b) => b.id === tab) ? "text-indigo-600" : "text-gray-400"}`}>
            <List size={20} />
            <span className="text-[10px]">More</span>
          </button>
        )}
      </nav>

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-[60px] left-0 right-0 bg-white rounded-t-2xl p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
            <div className="grid grid-cols-3 gap-2">
              {bottomMore.map((t) => (
                <button key={t.id} onClick={() => { setTab(t.id); setSearch(""); setMoreOpen(false); }} className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl ${tab === t.id ? "bg-indigo-50 text-indigo-600" : "bg-gray-50 text-gray-600"}`}>
                  <t.icon size={20} />
                  <span className="text-xs">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {taskModal && (
        <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setTaskModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-y-auto p-6" style={{ maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">{taskEditId ? "Edit task" : "New task"}</h2>
              <button onClick={() => { setTaskModal(false); setTaskEditId(null); }} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Associated with</label>
                <select className={inputCls} value={taskForm.clientId} onChange={(e) => setTaskForm({ ...taskForm, clientId: e.target.value })}>
                  <option value="general">— General / internal task —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Type</label>
                  <select className={inputCls} value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}>
                    {taskTypes.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Priority</label>
                  <select className={inputCls} value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                    {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Title *</label>
                <input className={inputCls} value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="e.g. Post monthly report on LinkedIn" />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea className={inputCls} rows={2} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Any details…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Due date</label>
                  <input type="date" className={inputCls} value={taskForm.due} onChange={(e) => setTaskForm({ ...taskForm, due: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Due time (optional)</label>
                  <input type="time" className={inputCls} value={taskForm.dueTime} onChange={(e) => setTaskForm({ ...taskForm, dueTime: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Assignee</label>
                <select className={inputCls} value={taskForm.assignee} onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })}>
                  <option value="">Unassigned</option>
                  {knownPeople.map((m) => <option key={m} value={m}>{ownerName(m)}{m === myEmail ? " (you)" : ""}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setTaskModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
              <button onClick={createTask} disabled={!taskForm.title.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">{taskEditId ? "Save changes" : "Create task"}</button>
            </div>
          </div>
        </div>
      )}

      {profileModal && (
        <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setProfileModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">My profile</h2>
              <button onClick={() => setProfileModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="flex flex-col items-center mb-4">
              {profileForm.avatar ? (
                <img src={profileForm.avatar} alt="avatar" className="w-20 h-20 rounded-full object-cover mb-2" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl font-semibold mb-2">{(profileForm.name || ownerName(myEmail)).slice(0, 1).toUpperCase()}</div>
              )}
              <label className="text-xs text-indigo-600 hover:text-indigo-700 cursor-pointer">
                {uploadingAvatar ? "Uploading…" : "Upload photo"}
                <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" disabled={uploadingAvatar} />
              </label>
            </div>
            <label className={labelCls}>Display name</label>
            <input className={inputCls} value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="e.g. Parvez" />
            <p className="text-xs text-gray-400 mt-1">{myEmail}</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setProfileModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
              <button onClick={saveProfile} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">Save</button>
            </div>
          </div>
        </div>
      )}

      {completing && (
        <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setCompleting(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Check size={17} className="text-emerald-600" /> Complete task</h2>
              <button onClick={() => setCompleting(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Attach proof of work — a link, a note, and/or an image. At least one is required.</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Proof link (URL)</label>
                <input className={inputCls} value={proofLink} onChange={(e) => setProofLink(e.target.value)} placeholder="e.g. https://linkedin.com/posts/…" />
              </div>
              <div>
                <label className={labelCls}>Note</label>
                <textarea className={inputCls} rows={2} value={proofNote} onChange={(e) => setProofNote(e.target.value)} placeholder="e.g. Posted the May report, tagged the client" />
              </div>
              <div>
                <label className={labelCls}>Image (screenshot / photo)</label>
                {proofImage ? (
                  <div className="flex items-center gap-2">
                    <img src={proofImage} alt="proof" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                    <button onClick={() => setProofImage("")} className="text-xs text-red-500 hover:text-red-600">Remove</button>
                  </div>
                ) : (
                  <label className={`flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm cursor-pointer hover:border-indigo-400 transition ${uploadingProof ? "opacity-60" : ""}`}>
                    <Upload size={15} className="text-gray-400" />
                    {uploadingProof ? "Uploading…" : "Add image"}
                    <input type="file" accept="image/*" onChange={uploadProofImage} className="hidden" disabled={uploadingProof} />
                  </label>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setCompleting(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
              <button onClick={confirmComplete} disabled={!proofLink.trim() && !proofNote.trim() && !proofImage} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50">Mark complete</button>
            </div>
          </div>
        </div>
      )}

      {importPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setImportPreview(null)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl flex flex-col p-6" style={{ maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-emerald-600" />
                Import preview
              </h2>
              <button onClick={() => setImportPreview(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Found {importPreview.length} lead{importPreview.length !== 1 ? "s" : ""} in your file.
              {importNiche && ` Tagged as "${importNiche}".`}
              {importPreview.filter((r) => r.isDup).length > 0 && ` ${importPreview.filter((r) => r.isDup).length} look like duplicates of leads already in your CRM.`}
            </p>
            {importPreview.filter((r) => r.isDup).length > 0 && (
              <label className="flex items-center gap-2 text-xs text-gray-600 mb-3 cursor-pointer">
                <input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} className="rounded" />
                Skip duplicate rows (recommended)
              </label>
            )}
            <div className="overflow-auto border border-gray-200 rounded-lg" style={{ maxHeight: "50vh", minHeight: 0 }}>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {["", "Company", "Contact", "Niche", "Country", "Email", "Phone", "Service", "Value", "Stage"].map((h, i) => (
                      <th key={i} className="text-left font-medium text-gray-500 px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 50).map((r) => (
                    <tr key={r.id} className={`border-t border-gray-100 ${r.isDup ? "bg-amber-50" : ""}`}>
                      <td className="px-3 py-2">{r.isDup && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 whitespace-nowrap">Dup</span>}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{r.company || "—"}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.name || "—"}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.category || "—"}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.country || "—"}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.email || "—"}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.phone || "—"}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.service}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.value ? fmt(r.value) : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full border text-xs ${STAGE_COLORS[r.stage]}`}>{r.stage}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importPreview.length > 50 && (
                <p className="text-xs text-gray-400 px-3 py-2 bg-gray-50 border-t border-gray-100">
                  Showing first 50 of {importPreview.length} rows — all {importPreview.filter((r) => !(skipDup && r.isDup)).length} will be imported.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4 shrink-0">
              <button onClick={() => setImportPreview(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
              <button onClick={confirmImport} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition">
                Import {importPreview.filter((r) => !(skipDup && r.isDup)).length} lead{importPreview.filter((r) => !(skipDup && r.isDup)).length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-y-auto p-6" style={{ maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">
                {editId ? "Edit" : "Add"} {modal === "lead" ? "lead" : "client"}
              </h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Contact name</label>
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ahmad Rahman" />
              </div>
              <div>
                <label className={labelCls}>Company</label>
                <input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="e.g. ABC Trading" />
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <input className={inputCls} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="e.g. Malaysia" />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" />
              </div>
              <div>
                <label className={labelCls}>Phone / WhatsApp</label>
                <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+60…" />
              </div>
              <div>
                <label className={labelCls}>Niche / category</label>
                <input className={inputCls} list="niche-list" value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Education" />
                <datalist id="niche-list">
                  {NICHES.map((n) => <option key={n} value={n} />)}
                </datalist>
              </div>

              {modal === "lead" ? (
                <>
                  <div>
                    <label className={labelCls}>Source</label>
                    <select className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                      {SOURCES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Service interest</label>
                    <select className={inputCls} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}>
                      {SERVICES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Estimated value (RM)</label>
                    <input type="number" className={inputCls} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="e.g. 2500" />
                  </div>
                  <div>
                    <label className={labelCls}>Stage</label>
                    <select className={inputCls} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                      {STAGES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Next follow-up</label>
                    <input type="date" className={inputCls} value={form.nextFollowUp || ""} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Website</label>
                    <input className={inputCls} value={form.website || ""} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="www.example.com" />
                  </div>
                  <div>
                    <label className={labelCls}>Owner (assigned to)</label>
                    <input className={inputCls} list="owner-list" value={form.owner || ""} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="defaults to you" />
                    <datalist id="owner-list">
                      {usedOwners.map((o) => <option key={o} value={o} />)}
                    </datalist>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>Monthly retainer (RM)</label>
                    <input type="number" className={inputCls} value={form.retainer} onChange={(e) => setForm({ ...form, retainer: e.target.value })} placeholder="e.g. 1500" />
                  </div>
                  <div>
                    <label className={labelCls}>Services</label>
                    <input className={inputCls} value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} placeholder="e.g. SEO + Social Media" />
                  </div>
                  <div>
                    <label className={labelCls}>Start date</label>
                    <input type="date" className={inputCls} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Last contact</label>
                    <input type="date" className={inputCls} value={form.lastContact} onChange={(e) => setForm({ ...form, lastContact: e.target.value })} />
                  </div>
                </>
              )}

              <div className="col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything worth remembering…" />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
              <button onClick={saveItem} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
                {editId ? "Save changes" : modal === "lead" ? "Add lead" : "Add client"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-2" style={{ maxWidth: "90vw" }}>
          <Check size={15} className="text-emerald-400 shrink-0" />
          <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  );
}

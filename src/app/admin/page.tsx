"use client";

import { useState, Suspense, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import {
  Box,
  Card,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Skeleton,
  MenuItem,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  Select,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import TableSortLabel from "@mui/material/TableSortLabel";

type User = {
  email: string;
  role: string;
  created_at?: string;
};

type DynamicListEntry = {
  id: number;
  value: string;
};

type ListType = "breeds" | "origin-sources" | "acquisition-types";

const LIST_CONFIGS: { type: ListType; label: string; singular: string }[] = [
  { type: "breeds", label: "Breeds", singular: "Breed" },
  { type: "origin-sources", label: "Origin Sources", singular: "Origin Source" },
  { type: "acquisition-types", label: "Acquisition Types", singular: "Acquisition Type" },
];

async function fetchUsersApi(): Promise<User[]> {
  const res = await fetch("/api/admin/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

async function fetchDynamicListApi(type: string): Promise<DynamicListEntry[]> {
  const res = await fetch(`/api/dynamic-lists/${type}`);
  if (!res.ok) throw new Error(`Failed to fetch ${type}`);
  return res.json();
}

async function addUserApi(data: { email: string; role: string }): Promise<User> {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to add user");
  }
  return res.json();
}

async function removeUserApi(email: string): Promise<void> {
  const res = await fetch("/api/admin/users", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to remove user");
  }
}

async function updateRoleApi(data: { email: string; role: string }): Promise<void> {
  const res = await fetch("/api/admin/users", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to update role");
  }
}

async function addListValueApi(type: string, value: string): Promise<DynamicListEntry> {
  const res = await fetch(`/api/dynamic-lists/${type}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to add value");
  }
  return res.json();
}

async function renameListValueApi(type: string, id: number, value: string): Promise<void> {
  const res = await fetch(`/api/dynamic-lists/${type}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, value }),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to rename value");
  }
}

async function removeListValueApi(type: string, id: number): Promise<void> {
  const res = await fetch(`/api/dynamic-lists/${type}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to remove value");
  }
}

async function mergeListValuesApi(type: string, sourceId: number, targetId: number): Promise<void> {
  const res = await fetch(`/api/dynamic-lists/${type}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId, targetId }),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to merge values");
  }
}

const addUserSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["Admin", "Viewer"]),
});

type AddUserFormValues = z.infer<typeof addUserSchema>;

const addListValueSchema = z.object({
  value: z.string().min(1, "Value is required"),
});

type AddListValueFormValues = z.infer<typeof addListValueSchema>;

const renameListValueSchema = z.object({
  value: z.string().min(1, "Value is required"),
});

type RenameListValueFormValues = z.infer<typeof renameListValueSchema>;

const userColumnHelper = createColumnHelper<User>();

const userColumns = [
  userColumnHelper.accessor("email", {
    header: "Email",
  }),
  userColumnHelper.accessor("role", {
    header: "Role",
  }),
  userColumnHelper.display({
    id: "actions",
    header: "",
  }),
];

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmIcon,
  onConfirm,
  onCancel,
  pending,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmIcon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={pending} aria-label="Cancel">
          <CloseIcon />
        </Button>
        <Button onClick={onConfirm} variant="contained" color="error" disabled={pending} aria-label={confirmLabel}>
          {pending ? <CircularProgress size={20} /> : (confirmIcon ?? <CheckIcon />)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      }
    >
      <AdminContent />
    </Suspense>
  );
}

function AdminContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = session?.user?.role === "Admin";
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [tabIndex, setTabIndex] = useState(0);
  const [userSorting, setUserSorting] = useState<SortingState>([]);

  const [removeUserEmail, setRemoveUserEmail] = useState<string | null>(null);
  const [removeListEntry, setRemoveListEntry] = useState<{ type: ListType; entry: DynamicListEntry } | null>(null);
  const [mergeDialog, setMergeDialog] = useState<{ type: ListType; sourceId: number; targetId: number; sourceValue: string; targetValue: string } | null>(null);

  const [renamingEntry, setRenamingEntry] = useState<{ type: ListType; entry: DynamicListEntry } | null>(null);
  const [mergeTargets, setMergeTargets] = useState<Record<string, Record<number, string>>>({});

  const { data: users, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchUsersApi,
    enabled: status === "authenticated" && isAdmin,
  });

  const { data: breeds, isLoading: breedsLoading, error: breedsError } = useQuery({
    queryKey: ["dynamic-lists", "breeds"],
    queryFn: () => fetchDynamicListApi("breeds"),
    enabled: status === "authenticated" && isAdmin,
  });

  const { data: originSources, isLoading: originLoading, error: originError } = useQuery({
    queryKey: ["dynamic-lists", "origin-sources"],
    queryFn: () => fetchDynamicListApi("origin-sources"),
    enabled: status === "authenticated" && isAdmin,
  });

  const { data: acquisitionTypes, isLoading: acqLoading, error: acqError } = useQuery({
    queryKey: ["dynamic-lists", "acquisition-types"],
    queryFn: () => fetchDynamicListApi("acquisition-types"),
    enabled: status === "authenticated" && isAdmin,
  });

  const addUserMutation = useMutation({
    mutationFn: addUserApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      addUserForm.reset();
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: removeUserApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setRemoveUserEmail(null);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: updateRoleApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const addListValueMutation = useMutation({
    mutationFn: ({ type, value }: { type: string; value: string }) => addListValueApi(type, value),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-lists", variables.type] });
      addListForm.reset();
    },
  });

  const renameListValueMutation = useMutation({
    mutationFn: ({ type, id, value }: { type: string; id: number; value: string }) => renameListValueApi(type, id, value),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-lists", variables.type] });
      setRenamingEntry(null);
    },
  });

  const removeListValueMutation = useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) => removeListValueApi(type, id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-lists", variables.type] });
      setRemoveListEntry(null);
    },
  });

  const mergeListValuesMutation = useMutation({
    mutationFn: ({ type, sourceId, targetId }: { type: string; sourceId: number; targetId: number }) =>
      mergeListValuesApi(type, sourceId, targetId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-lists", variables.type] });
      setMergeDialog(null);
    },
  });

  const addUserForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    mode: "onBlur",
    defaultValues: { email: "", role: "Viewer" },
  });

  const addListForm = useForm<AddListValueFormValues>({
    resolver: zodResolver(addListValueSchema),
    mode: "onBlur",
    defaultValues: { value: "" },
  });

  const renameForm = useForm<RenameListValueFormValues>({
    resolver: zodResolver(renameListValueSchema),
    mode: "onBlur",
    defaultValues: { value: "" },
  });

  const addUserErrors = addUserForm.formState.errors;
  const addListErrors = addListForm.formState.errors;
  const renameErrors = renameForm.formState.errors;

  const userList = users ?? [];

  const userTable = useReactTable({
    data: userList,
    columns: userColumns,
    state: { sorting: userSorting },
    onSortingChange: setUserSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const listData: Record<ListType, { entries: DynamicListEntry[] | undefined; loading: boolean; error: Error | null }> = {
    breeds: { entries: breeds, loading: breedsLoading, error: breedsError },
    "origin-sources": { entries: originSources, loading: originLoading, error: originError },
    "acquisition-types": { entries: acquisitionTypes, loading: acqLoading, error: acqError },
  };

  const currentListType = useMemo((): ListType | null => {
    if (tabIndex === 0) return null;
    return LIST_CONFIGS[tabIndex - 1]?.type ?? null;
  }, [tabIndex]);

  useEffect(() => {
    addListForm.reset();
    addListValueMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabIndex]);

  const handleAddUser = (data: AddUserFormValues) => {
    addUserMutation.mutate({ email: data.email, role: data.role });
  };

  const handleAddListValue = (data: AddListValueFormValues) => {
    if (!currentListType) return;
    addListValueMutation.mutate({ type: currentListType, value: data.value });
  };

  const handleStartRename = (type: ListType, entry: DynamicListEntry) => {
    setRenamingEntry({ type, entry });
    renameForm.reset({ value: entry.value });
  };

  const handleSaveRename = (data: RenameListValueFormValues) => {
    if (!renamingEntry) return;
    renameListValueMutation.mutate({
      type: renamingEntry.type,
      id: renamingEntry.entry.id,
      value: data.value.trim(),
    });
  };

  const handleMergeClick = (type: ListType, sourceId: number, targetIdStr: string, entries: DynamicListEntry[]) => {
    const targetId = parseInt(targetIdStr, 10);
    if (!targetId || isNaN(targetId)) return;
    const source = entries.find((e) => e.id === sourceId);
    const target = entries.find((e) => e.id === targetId);
    if (!source || !target) return;
    setMergeDialog({ type, sourceId, targetId, sourceValue: source.value, targetValue: target.value });
  };

  const handleConfirmMerge = () => {
    if (!mergeDialog) return;
    mergeListValuesMutation.mutate({
      type: mergeDialog.type,
      sourceId: mergeDialog.sourceId,
      targetId: mergeDialog.targetId,
    });
  };

  if (status === "loading") {
    return (
      <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/");
    return null;
  }

  if (!isAdmin) {
    router.push("/");
    return null;
  }

  const tabLabelId = (index: number) => `admin-tab-${index}`;
  const tabPanelId = (index: number) => `admin-tabpanel-${index}`;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: { xs: 1, sm: 2 } }}>
      <Typography variant="h5" gutterBottom>
        Admin
      </Typography>

      <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          aria-label="Admin sections"
          variant="fullWidth"
          sx={{ mb: 2 }}
        >
          <Tab label="Users" id={tabLabelId(0)} aria-controls={tabPanelId(0)} />
          {LIST_CONFIGS.map((c, i) => (
            <Tab key={c.type} label={c.label} id={tabLabelId(i + 1)} aria-controls={tabPanelId(i + 1)} />
          ))}
        </Tabs>

        {tabIndex === 0 && (
          <Box role="tabpanel" id={tabPanelId(0)} aria-labelledby={tabLabelId(0)}>
            <Stack spacing={2}>
              <Box
                component="form"
                onSubmit={addUserForm.handleSubmit(handleAddUser)}
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  gap: 2,
                  alignItems: "flex-start",
                  p: 2,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <Controller
                  name="email"
                  control={addUserForm.control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Email address"
                      placeholder="user@example.com"
                      type="email"
                      error={!!addUserErrors.email}
                      helperText={addUserErrors.email?.message}
                      fullWidth
                      size="small"
                      disabled={addUserMutation.isPending}
                    />
                  )}
                />
                <Controller
                  name="role"
                  control={addUserForm.control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Role"
                      error={!!addUserErrors.role}
                      helperText={addUserErrors.role?.message}
                      fullWidth={isMobile}
                      sx={{ minWidth: { xs: 0, sm: 140 } }}
                      size="small"
                      disabled={addUserMutation.isPending}
                    >
                      <MenuItem value="Viewer">Viewer</MenuItem>
                      <MenuItem value="Admin">Admin</MenuItem>
                    </TextField>
                  )}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={addUserMutation.isPending}
                  fullWidth={isMobile}
                  aria-label={addUserMutation.isPending ? "Adding" : "Add User"}
                  sx={{ minWidth: { xs: 0, sm: 0 }, p: 1, width: { xs: "100%", sm: 42 }, height: { xs: "auto", sm: 42 } }}
                >
                  {addUserMutation.isPending ? <CircularProgress size={20} /> : <AddIcon />}
                </Button>
              </Box>

              {addUserMutation.isError && (
                <Alert severity="error">{addUserMutation.error.message}</Alert>
              )}
              {addUserMutation.isSuccess && (
                <Alert severity="success">User added successfully!</Alert>
              )}
              {updateRoleMutation.isError && (
                <Alert severity="error">{updateRoleMutation.error.message}</Alert>
              )}
              {removeUserMutation.isError && (
                <Alert severity="error">{removeUserMutation.error.message}</Alert>
              )}

              {usersLoading ? (
                <Stack spacing={1}>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} variant="rectangular" height={48} />
                  ))}
                </Stack>
              ) : usersError ? (
                <Alert severity="error">Failed to load users</Alert>
              ) : userTable.getRowModel().rows.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={3}>
                  No users found.
                </Typography>
              ) : (
                <TableContainer sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      {userTable.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableCell key={header.id} sx={{ py: { xs: 0.5, sm: 1 } }}>
                              {header.isPlaceholder ? null : header.id === "actions" ? null : (
                                <TableSortLabel
                                  active={header.column.getIsSorted() !== false}
                                  direction={
                                    header.column.getIsSorted() === "asc"
                                      ? "asc"
                                      : header.column.getIsSorted() === "desc"
                                        ? "desc"
                                        : undefined
                                  }
                                  onClick={header.column.getToggleSortingHandler()}
                                  sx={{ fontWeight: 600, fontSize: "0.875rem" }}
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                </TableSortLabel>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableHead>
                    <TableBody>
                      {userTable.getRowModel().rows.map((row) => (
                        <TableRow key={row.original.email}>
                          <TableCell sx={{ py: { xs: 0.5, sm: 1 } }}>{row.original.email}</TableCell>
                          <TableCell sx={{ py: { xs: 0.5, sm: 1 } }}>
                            <Select
                              value={row.original.role}
                              onChange={(e) =>
                                updateRoleMutation.mutate({
                                  email: row.original.email,
                                  role: e.target.value,
                                })
                              }
                              size="small"
                              sx={{
                                minWidth: { xs: 80, sm: 100 },
                                fontSize: "0.8rem",
                                fontWeight: 600,
                              }}
                              disabled={updateRoleMutation.isPending}
                            >
                              <MenuItem value="Viewer">Viewer</MenuItem>
                              <MenuItem value="Admin">Admin</MenuItem>
                            </Select>
                          </TableCell>
                          <TableCell sx={{ py: { xs: 0.5, sm: 1 } }} align="right">
                            {row.original.email !== session?.user?.email && (
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setRemoveUserEmail(row.original.email)}
                                aria-label="Remove user"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Stack>
          </Box>
        )}

        {LIST_CONFIGS.map((config, i) => {
          const type = config.type;
          const tabIdx = i + 1;
          const { entries, loading, error } = listData[type];
          const entriesList = entries ?? [];

          return (
            <Box
              key={type}
              role="tabpanel"
              hidden={tabIndex !== tabIdx}
              id={tabPanelId(tabIdx)}
              aria-labelledby={tabLabelId(tabIdx)}
            >
              {tabIndex === tabIdx && (
                <Stack spacing={2}>
                  <Box
                    component="form"
                    onSubmit={addListForm.handleSubmit(handleAddListValue)}
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", sm: "row" },
                      gap: 2,
                      alignItems: "flex-start",
                      p: 2,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 2,
                    }}
                  >
                    <Controller
                      name="value"
                      control={addListForm.control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label={`New ${config.singular.toLowerCase()}`}
                          placeholder={`Enter ${config.singular.toLowerCase()}...`}
                          error={!!addListErrors.value}
                          helperText={addListErrors.value?.message}
                          fullWidth
                          size="small"
                          disabled={addListValueMutation.isPending}
                        />
                      )}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={addListValueMutation.isPending}
                      fullWidth={isMobile}
                      aria-label={addListValueMutation.isPending ? "Adding" : "Add"}
                      sx={{ minWidth: { xs: 0, sm: 0 }, p: 1, width: { xs: "100%", sm: 42 }, height: { xs: "auto", sm: 42 } }}
                    >
                      {addListValueMutation.isPending ? <CircularProgress size={20} /> : <AddIcon />}
                    </Button>
                  </Box>

                  {addListValueMutation.isError && (
                    <Alert severity="error">{addListValueMutation.error.message}</Alert>
                  )}
                  {addListValueMutation.isSuccess && (
                    <Alert severity="success">{config.singular} added!</Alert>
                  )}
                  {renameListValueMutation.isError && (
                    <Alert severity="error">{renameListValueMutation.error.message}</Alert>
                  )}
                  {removeListValueMutation.isError && (
                    <Alert severity="error">{removeListValueMutation.error.message}</Alert>
                  )}
                  {mergeListValuesMutation.isError && (
                    <Alert severity="error">{mergeListValuesMutation.error.message}</Alert>
                  )}

                  {loading ? (
                    <Stack spacing={1}>
                      {[1, 2, 3].map((n) => (
                        <Skeleton key={n} variant="rectangular" height={48} />
                      ))}
                    </Stack>
                  ) : error ? (
                    <Alert severity="error">Failed to load {config.label.toLowerCase()}</Alert>
                  ) : entriesList.length === 0 ? (
                    <Typography color="text.secondary" textAlign="center" py={3}>
                      No {config.label.toLowerCase()} defined yet.
                    </Typography>
                  ) : (
                    <List dense>
                      {entriesList.map((entry) => {
                        const isRenaming = renamingEntry?.type === type && renamingEntry.entry.id === entry.id;
                        const mergeTarget = mergeTargets[type]?.[entry.id] || "";
                        const otherEntries = entriesList.filter((e) => e.id !== entry.id);

                        return (
                          <ListItem
                            key={entry.id}
                            sx={{
                              borderBottom: 1,
                              borderColor: "divider",
                              flexDirection: "column",
                              alignItems: "stretch",
                              py: 1,
                            }}
                          >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              {isRenaming ? (
                                <Box
                                  component="form"
                                  onSubmit={renameForm.handleSubmit(handleSaveRename)}
                                  sx={{ display: "flex", gap: 1, flex: 1, alignItems: "center" }}
                                >
                                  <Controller
                                    name="value"
                                    control={renameForm.control}
                                    render={({ field }) => (
                                      <TextField
                                        {...field}
                                        autoFocus
                                        size="small"
                                        fullWidth
                                        error={!!renameErrors.value}
                                        helperText={renameErrors.value?.message}
                                        disabled={renameListValueMutation.isPending}
                                      />
                                    )}
                                  />
                                  <IconButton
                                    type="submit"
                                    size="small"
                                    color="primary"
                                    disabled={renameListValueMutation.isPending}
                                  >
                                    <CheckIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => setRenamingEntry(null)}
                                    disabled={renameListValueMutation.isPending}
                                  >
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              ) : (
                                <>
                                  <ListItemText primary={entry.value} sx={{ flex: 1 }} />
                                  <IconButton
                                    size="small"
                                    onClick={() => handleStartRename(type, entry)}
                                    aria-label={`Rename ${entry.value}`}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => setRemoveListEntry({ type, entry })}
                                    aria-label={`Remove ${entry.value}`}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </>
                              )}
                            </Box>

                            {!isRenaming && otherEntries.length > 0 && (
                              <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1, alignItems: { xs: "stretch", sm: "center" }, mt: 0.5, pl: 1 }}>
                                <Select
                                  size="small"
                                  value={mergeTarget}
                                  onChange={(e) =>
                                    setMergeTargets((prev) => ({
                                      ...prev,
                                      [type]: { ...(prev[type] || {}), [entry.id]: e.target.value },
                                    }))
                                  }
                                  displayEmpty
                                  sx={{ minWidth: { xs: 0, sm: 160 }, fontSize: "0.8rem" }}
                                >
                                  <MenuItem value="" disabled>
                                    Merge into...
                                  </MenuItem>
                                  {otherEntries.map((e) => (
                                    <MenuItem key={e.id} value={e.id}>
                                      {e.value}
                                    </MenuItem>
                                  ))}
                                </Select>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={!mergeTarget}
                                  onClick={() => handleMergeClick(type, entry.id, mergeTarget, entriesList)}
                                  fullWidth={isMobile}
                                  aria-label="Merge"
                                  sx={{ fontSize: "0.75rem", minWidth: { xs: 0, sm: 0 }, p: 0.5 }}
                                >
                                  <MergeTypeIcon />
                                </Button>
                              </Box>
                            )}
                          </ListItem>
                        );
                      })}
                    </List>
                  )}
                </Stack>
              )}
            </Box>
          );
        })}
      </Card>

      <ConfirmDialog
        open={removeUserEmail !== null}
        title="Remove User"
        message={`Are you sure you want to remove ${removeUserEmail ?? ""}? This will revoke their access.`}
        confirmLabel="Remove"
        confirmIcon={<DeleteForeverIcon />}
        pending={removeUserMutation.isPending}
        onConfirm={() => {
          if (removeUserEmail) removeUserMutation.mutate(removeUserEmail);
        }}
        onCancel={() => setRemoveUserEmail(null)}
      />

      <ConfirmDialog
        open={removeListEntry !== null}
        title="Remove Value"
        message={
          removeListEntry
            ? `Are you sure you want to remove "${removeListEntry.entry.value}"? This will fail if it is in use by chickens.`
            : ""
        }
        confirmLabel="Remove"
        confirmIcon={<DeleteForeverIcon />}
        pending={removeListValueMutation.isPending}
        onConfirm={() => {
          if (removeListEntry) {
            removeListValueMutation.mutate({ type: removeListEntry.type, id: removeListEntry.entry.id });
          }
        }}
        onCancel={() => setRemoveListEntry(null)}
      />

      <ConfirmDialog
        open={mergeDialog !== null}
        title="Merge Values"
        message={
          mergeDialog
            ? `Merge "${mergeDialog.sourceValue}" into "${mergeDialog.targetValue}"? All chickens using "${mergeDialog.sourceValue}" will be updated to use "${mergeDialog.targetValue}", and "${mergeDialog.sourceValue}" will be deleted.`
            : ""
        }
        confirmLabel="Merge"
        confirmIcon={<MergeTypeIcon />}
        pending={mergeListValuesMutation.isPending}
        onConfirm={handleConfirmMerge}
        onCancel={() => setMergeDialog(null)}
      />
    </Box>
  );
}

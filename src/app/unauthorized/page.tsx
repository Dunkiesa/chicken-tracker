import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

export default function UnauthorizedPage() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "80vh",
        p: 2,
      }}
    >
      <Container maxWidth="sm" sx={{ textAlign: "center" }}>
        <Typography variant="h4" gutterBottom>
          Not Authorized
        </Typography>
        <Typography color="text.secondary" paragraph>
          Your Google account was authenticated, but your email is not in the
          allowlist for this app. Contact an admin to gain access.
        </Typography>
        <Button
          variant="contained"
          color="error"
          href="/api/auth/signout"
          sx={{ mt: 2 }}
        >
          Sign Out
        </Button>
      </Container>
    </Box>
  );
}

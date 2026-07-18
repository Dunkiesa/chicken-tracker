import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

export default function AuthErrorPage() {
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
          Authentication Error
        </Typography>
        <Typography color="text.secondary" sx={{
          marginBottom: "16px"
        }}>
          Something went wrong during sign-in. Please try again.
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="outlined" href="/"><ArrowBackIcon /></Button>
        </Box>
      </Container>
    </Box>
  );
}

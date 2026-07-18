import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

export default function NotFound() {
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
          Page not found
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          The page you were looking for doesn&apos;t exist or has been moved.
        </Typography>
        <Button variant="contained" component={Link} href="/">
          Go home
        </Button>
      </Container>
    </Box>
  );
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the requesting user is admin or super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user has admin or super_admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !roleData || (roleData.role !== "admin" && roleData.role !== "super_admin")) {
      throw new Error("Unauthorized: Admin or Super Admin role required");
    }

    const { email, password, full_name, role } = await req.json();

    // Security: Never allow super_admin assignment
    if (role === "super_admin") {
      throw new Error("Super Admin role cannot be assigned via invite");
    }

    // Validate role
    const validRoles = ["admin", "project_manager", "collaborator"];
    if (!validRoles.includes(role)) {
      throw new Error("Invalid role specified");
    }

    // Check if user already exists
    console.log(`Checking if user exists: ${email}`);
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email === email);

    let userId: string;
    
    if (existingUser) {
      console.log(`User already exists: ${existingUser.id}, updating role to: ${role}`);
      userId = existingUser.id;
      
      // Update existing user's metadata and confirm email
      await supabaseClient.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { full_name },
        email_confirm: true, // Force email confirmation
      });
      
      // Update password for existing user
      const { error: passwordError } = await supabaseClient.auth.admin.updateUserById(
        existingUser.id,
        { password }
      );

      if (passwordError) {
        console.error("Error updating password:", passwordError);
      } else {
        console.log("Password updated successfully");
      }
    } else {
      // Create new user with immediate email confirmation
      console.log(`Creating new user: ${email} with role: ${role}`);
      
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email for admin-created users
        user_metadata: {
          full_name,
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        throw createError;
      }

      if (!newUser.user) {
        console.error("No user returned from creation");
        throw new Error("Failed to create user");
      }

      userId = newUser.user.id;
      console.log(`User created successfully with confirmed email: ${userId}`);
    }

    // Update or create profile
    console.log(`Updating profile for user: ${userId}`);
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .upsert({
        id: userId,
        email: email,
        full_name: full_name,
      }, {
        onConflict: "id"
      });

    if (profileError) {
      console.error("Profile update error:", profileError);
      // Don't fail the whole operation if profile update fails
    } else {
      console.log("Profile updated successfully");
    }

    // Assign role to the user (use upsert to handle existing roles)
    console.log(`Assigning role ${role} to user: ${userId}`);
    const { error: roleUpsertError } = await supabaseClient
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: role,
      }, {
        onConflict: "user_id,role"
      });

    if (roleUpsertError) {
      console.error("Role assignment error:", roleUpsertError);
      throw roleUpsertError;
    }

    console.log("Role assigned successfully");
    console.log(`✅ User invitation completed successfully for: ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email: email,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in invite-user function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

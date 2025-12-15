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

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get the role of the requesting user
    const { data: requesterRoleData, error: requesterRoleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (requesterRoleError || !requesterRoleData) {
      throw new Error("Requester role not found");
    }

    const requesterRole = requesterRoleData.role;
    console.log(`Delete request from user: ${user.id} with role: ${requesterRole}`);

    // Get target user ID from request
    const { user_id: targetUserId } = await req.json();

    if (!targetUserId) {
      throw new Error("Target user_id is required");
    }

    // Get target user's profile and role
    const { data: targetProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("email")
      .eq("id", targetUserId)
      .single();

    if (profileError || !targetProfile) {
      throw new Error("Target user not found");
    }

    const { data: targetRoleData, error: targetRoleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId)
      .single();

    if (targetRoleError || !targetRoleData) {
      throw new Error("Target user role not found");
    }

    const targetRole = targetRoleData.role;
    console.log(`Target user: ${targetUserId} (${targetProfile.email}) with role: ${targetRole}`);

    // HIERARCHICAL ACCESS CONTROL
    // Super_Admin can delete everyone except themselves
    // Admin can only delete Project_Manager and Collaborator
    // Project_Manager and Collaborator cannot delete anyone

    // Prevent self-deletion
    if (user.id === targetUserId) {
      throw new Error("Cannot delete your own account");
    }

    // Hierarchical role check
    if (requesterRole === "super_admin") {
      // Super_Admin can delete everyone
      console.log("Super_Admin deleting user - allowed");
    } else if (requesterRole === "admin") {
      // Admin can only delete Project_Manager and Collaborator
      if (targetRole === "super_admin" || targetRole === "admin") {
        throw new Error("Admin cannot delete Super_Admin or Admin users");
      }
      console.log("Admin deleting non-admin user - allowed");
    } else {
      // Project_Manager and Collaborator cannot delete anyone
      throw new Error("Insufficient permissions to delete users");
    }

    console.log(`Authorization passed. Proceeding with deletion of user: ${targetUserId}`);

    // Log the deletion in audit_log BEFORE deleting
    const { error: auditError } = await supabaseClient
      .from("audit_log")
      .insert({
        performed_by: user.id,
        performed_by_role: requesterRole,
        action_type: "user_deletion",
        target_user_id: targetUserId,
        target_user_email: targetProfile.email,
        details: {
          target_role: targetRole,
          requester_email: user.email,
        },
      });

    if (auditError) {
      console.error("Error logging to audit_log:", auditError);
      // Continue with deletion even if audit fails
    } else {
      console.log("Audit log entry created successfully");
    }

    // Delete user from auth.users (cascades to profiles, user_roles, project_members)
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(
      targetUserId
    );

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      throw deleteError;
    }

    console.log(`✅ User ${targetUserId} deleted successfully by ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User deleted successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in delete-user function:", error);
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

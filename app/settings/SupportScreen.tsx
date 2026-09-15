import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DetailHeader } from "@/components/DetailHeader";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import {
  createSupportRequest,
  fetchSupportRequestsDailyStatus,
  getDataErrorMessage,
  notifySupportRequest,
  SupportRequestsDailyStatus,
} from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "Support">;

export default function SupportScreen(_props: Props) {
  const { session } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [dailyStatus, setDailyStatus] = useState<SupportRequestsDailyStatus | null>(null);

  // A failed fetch fails open (the form stays usable) - the "Users can
  // insert their own support requests" RLS policy is the actual
  // enforcement regardless of whether this call ever succeeds. Logged, not
  // silently swallowed, same reasoning as every other daily-status fetch
  // in this app.
  const refreshDailyStatus = useCallback(async () => {
    try {
      setDailyStatus(await fetchSupportRequestsDailyStatus());
    } catch (e) {
      console.warn("[SupportScreen] Kon dagelijkse klantenservicelimiet-status niet ophalen:", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshDailyStatus();
    }, [refreshDailyStatus])
  );

  const onSend = async () => {
    if (!session?.user || !subject.trim() || !message.trim() || sending) return;
    setError(null);
    setSending(true);
    try {
      await createSupportRequest(session.user.id, subject.trim(), message.trim());
      setSent(true);
      // Best-effort on top of the row that's already saved above - the
      // message getting to the Sportfrend inbox is a convenience, the
      // database row is the actual record. A failure here (e.g. the
      // Edge Function isn't deployed yet, or Resend rejects the request)
      // shouldn't undo the "message received" confirmation the user just
      // saw, since the message really was received.
      notifySupportRequest(subject.trim(), message.trim()).catch((notifyError) => {
        console.warn("[Support] E-mailmelding via Resend is mislukt:", notifyError);
      });
    } catch (e) {
      // Same pattern as ChatDetailScreen's onSend / ReportModal's onSubmit:
      // refresh the status first so a limit-triggered failure renders the
      // dedicated banner below instead of a generic error.
      refreshDailyStatus();
      setError(getDataErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const limitReached = dailyStatus != null && dailyStatus.remaining <= 0;

  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="Klantenservice" />
      <View style={styles.content}>
        {sent ? (
          <Text style={styles.confirmation}>
            Bedankt! We hebben je bericht ontvangen en reageren binnen 1 werkdag via e-mail.
          </Text>
        ) : limitReached ? (
          <Text style={styles.limitReached}>
            Je hebt vandaag het maximum van {dailyStatus!.dailyLimit} klantenservice-berichten bereikt. Probeer het
            morgen opnieuw, of mail rechtstreeks naar info.sportfrend@gmail.com.
          </Text>
        ) : (
          <>
            <Text style={styles.intro}>
              Kom je er niet uit? Stuur ons een bericht en we helpen je zo snel mogelijk verder.
            </Text>
            <Input label="Onderwerp" placeholder="Waar gaat je vraag over?" value={subject} onChangeText={setSubject} />
            <Input
              label="Bericht"
              placeholder="Beschrijf je vraag of probleem"
              value={message}
              onChangeText={setMessage}
              multiline
              style={styles.messageInput}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label="Versturen"
              onPress={onSend}
              loading={sending}
              disabled={!subject.trim() || !message.trim()}
              style={styles.cta}
            />
          </>
        )}
      </View>
      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
  },
  intro: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
    marginBottom: spacing.md,
  },
  messageInput: {
    height: 120,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  cta: {
    marginTop: spacing.sm,
  },
  confirmation: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.primaryDark,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  limitReached: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});

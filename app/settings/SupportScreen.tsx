import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DetailHeader } from "@/components/DetailHeader";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { createSupportRequest, getDataErrorMessage } from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "Support">;

export default function SupportScreen(_props: Props) {
  const { session } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSend = async () => {
    if (!session?.user || !subject.trim() || !message.trim() || sending) return;
    setError(null);
    setSending(true);
    try {
      await createSupportRequest(session.user.id, subject.trim(), message.trim());
      setSent(true);
    } catch (e) {
      setError(getDataErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="Klantenservice" />
      <View style={styles.content}>
        {sent ? (
          <Text style={styles.confirmation}>
            Bedankt! We hebben je bericht ontvangen en reageren binnen 1 werkdag via e-mail.
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
});

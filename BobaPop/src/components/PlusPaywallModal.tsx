import React from 'react';
import {
  Image,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IMAGES } from '../assets/images';
import {
  PLUS_BENEFITS,
  PLUS_PLANS,
  PlusPlanId,
  PRIVACY_POLICY_URL,
  TERMS_URL,
} from '../monetization/plus';

interface Props {
  visible: boolean;
  plusActive: boolean;
  onClose: () => void;
  onSelectPlan: (planId: PlusPlanId) => void;
  onRestore: () => void;
}

export const PlusPaywallModal: React.FC<Props> = ({
  visible,
  plusActive,
  onClose,
  onSelectPlan,
  onRestore,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <LinearGradient
            colors={['#FFF7E8', '#F6D6A8', '#C8873E']}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>

          <Image source={IMAGES.mascotHappy} style={styles.mascot} resizeMode="contain" />
          <Text style={styles.title}>BobaPop Plus</Text>
          <Text style={styles.subtitle}>More popping. Less waiting.</Text>

          <View style={styles.benefits}>
            {PLUS_BENEFITS.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>★</Text>
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>

          {plusActive ? (
            <View style={styles.activeCard}>
              <Text style={styles.activeTitle}>Plus is active</Text>
              <Text style={styles.activeText}>Your continues are ad-free.</Text>
            </View>
          ) : (
            <View style={styles.planList}>
              {PLUS_PLANS.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[styles.planCard, plan.badge && styles.planCardFeatured]}
                  onPress={() => onSelectPlan(plan.id)}
                  activeOpacity={0.86}
                >
                  {plan.badge && (
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>{plan.badge}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.planTitle}>{plan.title}</Text>
                    {plan.savings && <Text style={styles.planSavings}>{plan.savings}</Text>}
                  </View>
                  <View style={styles.planPriceWrap}>
                    <Text style={styles.planPrice}>{plan.price}</Text>
                    <Text style={styles.planPeriod}>/{plan.period}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.restoreBtn} onPress={onRestore} activeOpacity={0.8}>
            <Text style={styles.restoreText}>Restore Purchase</Text>
          </TouchableOpacity>

          <Text style={styles.termsText}>
            Renews automatically unless canceled at least 24 hours before the end of the current period.
            Manage or cancel anytime in App Store settings.
          </Text>
          <View style={styles.linksRow}>
            <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
              <Text style={styles.linkText}>Terms</Text>
            </TouchableOpacity>
            <Text style={styles.linkDivider}>•</Text>
            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
              <Text style={styles.linkText}>Privacy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(31, 13, 3, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(70, 30, 10, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#4B210A',
    fontSize: 27,
    lineHeight: 30,
    fontWeight: '800',
  },
  mascot: {
    width: 104,
    height: 104,
    alignSelf: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#54280C',
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#8A5424',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  benefits: {
    backgroundColor: 'rgba(255, 255, 255, 0.54)',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  benefitIcon: {
    width: 19,
    color: '#F2A51F',
    fontSize: 15,
    fontWeight: '900',
    textShadowColor: 'rgba(91, 42, 5, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  benefitText: {
    flex: 1,
    color: '#4B210A',
    fontSize: 15,
    fontWeight: '800',
  },
  planList: {
    gap: 10,
  },
  planCard: {
    minHeight: 70,
    borderRadius: 18,
    backgroundColor: 'rgba(70, 30, 10, 0.88)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  planCardFeatured: {
    backgroundColor: '#235B43',
    borderColor: '#FFD45C',
  },
  planBadge: {
    position: 'absolute',
    top: -10,
    left: 14,
    backgroundColor: '#FFD45C',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  planBadgeText: {
    color: '#4B210A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  planTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  planSavings: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  planPriceWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  planPrice: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  planPeriod: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    fontWeight: '800',
    paddingBottom: 3,
  },
  activeCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(35, 91, 67, 0.92)',
    padding: 16,
    alignItems: 'center',
  },
  activeTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  activeText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  restoreBtn: {
    alignSelf: 'center',
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  restoreText: {
    color: '#4B210A',
    fontSize: 14,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  termsText: {
    color: 'rgba(75, 33, 10, 0.76)',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  linkText: {
    color: '#4B210A',
    fontSize: 12,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  linkDivider: {
    color: '#4B210A',
    fontWeight: '900',
  },
});
